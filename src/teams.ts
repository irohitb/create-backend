import { Membership, Owner, TeamRole } from "./authenticator.ts";
import { Result, fail, success } from "./result.ts";
import { INVALID_TEXT_REPRESENTATION } from "./pg-errors.ts";
import * as postgres from "postgres";
import { JustId } from "./utils.ts";
import { Email } from "./email.ts";
import {
  createCustomerAccount,
  getCustomerAccount,
  promoteUserBalanceToTeam,
} from "./ledger.ts";

export type TeamId = string & { readonly __tag: unique symbol };
export type InviteId = string & { readonly __tag: unique symbol };
// this should eventually live elsewhere. Authenticator?
type UserId = string & { readonly __tag: unique symbol };

type InviteStatus =
  | "created"
  | "pending"
  | "accepted"
  | "rejected"
  | "expired"
  | "revoked";

type TeamMemberRow = {
  id: UserId;
  email: string;
  full_name: string;
  team_role: TeamRole;
};

export type TeamMember = {
  id: string;
  email: string;
  fullName: string;
  teamRole: TeamRole;
};

export type InboundInvite = {
  id: InviteId;
  teamName: string;
  inviterEmail: string;
};

export type OutboundInvite = {
  id: InviteId;
  inviterEmail: string;
  inviteeEmail: string;
  teamRole: TeamRole;
  status: InviteStatus;
  updatedAt: Date;
};

type InboundInviteRow = {
  id: InviteId;
  name: string;
  inviter_email: string;
};

type OutboundInviteRow = {
  id: InviteId;
  inviter_email: string;
  invitee_email: string;
  team_role: TeamRole;
  status: InviteStatus;
  updated_at: Date;
};

type TeamData = {
  user_id: string;
  team_id: string;
  team_role: TeamRole;
};

type SentInviteRow = {
  status: InviteStatus;
  id: InviteId;
  updated_at: Date;
};

export type SendInvite = {
  status: InviteStatus;
  id: InviteId;
  updatedAt: Date;
};

type InvitabilityPropertiesRow = {
  invitee_email: Email;
  team_id: string | null;
  is_reinvitable: boolean | null;
};

export type Invitability =
  | "too-many-invites"
  | { type: "invitable"; email: Email }
  | { type: "already-on-team"; teamId: string };

type AcceptanceOutcome =
  | "accept-success"
  | "accept-no-invite"
  | "accept-duplicate";

// This type has only one value. We could add a reject-failure
// case for when the invitation doesn't exist, but the end result
// of such an operation is identical to the success case:
//   there is no invite for this user by this id
type RejectionOutcome = "reject-success";

type RevocationOutcome = "revoke-success" | "revoke-failure";

type RemoveUserOutcome = "remove-success" | "user-not-in-team";

function transformInboundInviteRow(row: InboundInviteRow): InboundInvite {
  return {
    id: row.id,
    teamName: row.name,
    inviterEmail: row.inviter_email,
  };
}

function transformOutboundInviteRow(row: OutboundInviteRow): OutboundInvite {
  return {
    id: row.id,
    inviterEmail: row.inviter_email,
    inviteeEmail: row.invitee_email,
    teamRole: row.team_role,
    status: row.status,
    updatedAt: row.updated_at,
  };
}

function transformTeamMemberRow(row: TeamMemberRow): TeamMember {
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    teamRole: row.team_role,
  };
}

function transformSendInviteRow(row: SentInviteRow): SendInvite {
  return {
    id: row.id,
    status: row.status,
    updatedAt: row.updated_at,
  };
}

export async function create(
  supaDbClient: postgres.QueryClient,
  awsDbClient: postgres.QueryClient,
  ownerId: string,
  stripeCustomerId: string,
  teamName: string,
): Promise<Result<TeamId, null>> {
  const response = await supaDbClient.queryObject<JustId<TeamId>>`
    insert into teams (name, stripe_customer_id, subscription_is_valid)
    values (${teamName}, ${stripeCustomerId}, true)
    returning id`;
  const firstRow = response.rows[0] ?? null;
  if (!firstRow) {
    return fail(null);
  }

  const teamId = firstRow.id;

  const transaction = awsDbClient.createTransaction("user_creating_team");
  await transaction.begin();

  const accountResult = await createCustomerAccount(transaction, {
    id: teamId,
    type: "team",
  });

  if (accountResult.type == "FAILURE") {
    return fail(null);
  }

  const userAccount = await getCustomerAccount(transaction, {
    type: "user",
    id: ownerId,
  });
  if (userAccount) {
    await promoteUserBalanceToTeam(
      transaction,
      userAccount,
      accountResult.data,
    );
  }

  const response2 = await supaDbClient.queryObject<unknown>`
    insert into user_teams (user_id, team_id, team_role)
    values (${ownerId}, ${teamId}, 'owner')
    returning id`;

  if (response2.rowCount == 0) {
    transaction.rollback();
    return fail(null);
  }

  // we don't have the information on hand to create a new subscription
  // row upon team creation, but we know enough to translate any existing
  // user-assigned subscription into a team-assigned one
  await transaction.queryArray<unknown[]>`
    update subscriptions
    set billable_type = 'team', billable_id = ${teamId}
    where billable_type = 'user'
    and billable_id = ${ownerId}`;

  await transaction.queryArray<unknown[]>`
    insert into team_creation_square_ups (user_id, team_id, schedule_date, status)
    values (${ownerId}, ${firstRow.id}, now() + interval '30 minutes', 'pending')`;

  await transaction.commit();
  return success(firstRow.id);
}

export async function getUserTeamInfo(
  dbClient: postgres.QueryClient,
  userEmail: string,
): Promise<TeamData | null> {
  const data = await dbClient.queryObject<TeamData>`
    select user_teams.user_id, user_teams.team_id, user_teams.team_role
    from users
    join user_teams on user_teams.user_id = users.id
    where users.email = ${userEmail}
  `;
  return data.rows[0] ?? null;
}

export async function sendInvite(
  dbClient: postgres.QueryClient,
  ownerId: string,
  teamMembership: Owner<string>,
  recipientEmail: Email,
  teamRole: TeamRole,
): Promise<Result<SendInvite, null>> {
  const response = await dbClient.queryObject<SentInviteRow>`
    insert into invites (team_id, inviter_id, invitee_email, status, team_role, updated_at)
    values (${teamMembership.val}, ${ownerId}, ${recipientEmail}, 'pending', ${teamRole}, now())
    ON CONFLICT (team_id, invitee_email)
    DO UPDATE SET
      status = EXCLUDED.status,
      team_role = EXCLUDED.team_role,
      updated_at = NOW()
    returning id, status, updated_at`;
  const firstRow = response.rows[0] ?? null;
  if (!firstRow) {
    return fail(null);
  }
  return success(transformSendInviteRow(firstRow));
}

export async function getInboundInvites(
  dbClient: postgres.QueryClient,
  email: string,
): Promise<InboundInvite[]> {
  const response = await dbClient.queryObject<InboundInviteRow>`
    select invites.id, teams.name, users.email as inviter_email
    from invites
    join teams
    on teams.id = invites.team_id
    join users
    on users.id = invites.inviter_id
    where invites.invitee_email = ${email}
    and invites.status in ('created', 'pending')`;
  return response.rows.map(transformInboundInviteRow);
}

export async function getOutboundInvites(
  dbClient: postgres.QueryClient,
  teamMembership: Owner<string>,
): Promise<OutboundInvite[]> {
  const response = await dbClient.queryObject<OutboundInviteRow>`
    select invites.id, users.email as inviter_email, invites.invitee_email, invites.team_role, invites.status, invites.updated_at
    from invites
    join teams
    on teams.id = invites.team_id
    join users
    on users.id = invites.inviter_id
    where invites.team_id = ${teamMembership.val}`;
  return response.rows.map(transformOutboundInviteRow);
}

export async function acceptInvite(
  dbClient: postgres.QueryClient,
  inviteId: string,
  recipientEmail: string,
): Promise<AcceptanceOutcome> {
  // This query embeds a few different pieces of important logic,
  // the most subtle of which is the email checks.
  // Imagine I, authenticated as myself, attempt to accept an
  // invite using an invite id that isn't associated with me.
  // What happens?
  // In our query, we match based on BOTH the invite id (which could leak)
  // and the recipient email, which is derived from authentication.
  // If I make that call, the select will result in no found rows, and
  // we'll insert nothing.
  // An additional level of potential failure is somone, even after joining
  // a team, attempting to join a second. Normally, we'll block that
  // at the request level, but we could imagine a race condition. In that
  // case, we'll get a duplicate key error, which we need to catch.
  // Additionally, we can't event select by an invalid uuid, which will raise
  // an exception, rather than just return no values.
  try {
    const response = await dbClient.queryObject<OutboundInviteRow>`
      insert into user_teams (user_id, team_id, team_role)
      select users.id as user_id, team_id, team_role
      from invites
      join users
      on users.email = invites.invitee_email
      where invites.id = ${inviteId}
      and invitee_email = ${recipientEmail}
      and invites.status in ('created', 'pending')`;
    if (response.rowCount != 1) {
      return "accept-no-invite";
    }
  } catch (e) {
    if (e.fields.code == INVALID_TEXT_REPRESENTATION) {
      // this means that the invite isn't in the form of a uuid
      // as postgres understands it
      return "accept-no-invite";
    }
    return "accept-duplicate";
  }
  await dbClient.queryObject`
    update invites
    set status = 'accepted',
    updated_at = now()
    where invites.id = ${inviteId}`;
  return "accept-success";
}

export async function rejectInvite(
  dbClient: postgres.QueryClient,
  inviteId: string,
  recipientEmail: string,
): Promise<RejectionOutcome> {
  await dbClient.queryObject`
    update invites
    set status = 'rejected',
    updated_at = now()
    where invites.id = ${inviteId}
    and invites.invitee_email = ${recipientEmail}`;
  return "reject-success";
}

export async function revokeInvite(
  dbClient: postgres.QueryClient,
  inviteId: string,
  teamMembership: Owner<string>,
): Promise<RevocationOutcome> {
  const results = await dbClient.queryObject`
    update invites
    set status = 'revoked',
    updated_at = now()
    where invites.id = ${inviteId}
    and invites.team_id = ${teamMembership.val}
    and invites.status in ('created', 'pending')`;
  if (results.rowCount && results.rowCount > 0) {
    return "revoke-success";
  }
  // this obscures some different types of failure
  // did this fail because the invite doesn't exist?
  // did this fail because the invite is already accepted?
  // should the caller be made aware of these details?
  return "revoke-failure";
}

export async function getTeamMembers(
  dbClient: postgres.QueryClient,
  teamMembership: Owner<string>,
): Promise<TeamMember[]> {
  const response = await dbClient.queryObject<TeamMemberRow>`
    select users.id, users.email, users.full_name, user_teams.team_role
    from users
    join user_teams
    on user_teams.user_id = users.id
    where user_teams.team_id = ${teamMembership.val}`;
  return response.rows.map(transformTeamMemberRow);
}

export async function getTeamName(
  dbClient: postgres.QueryClient,
  teamMembership: Membership<string>,
): Promise<string | null> {
  const response = await dbClient.queryObject<{ name: string }>`
    select name from teams where id = ${teamMembership.val}`;
  return response.rows[0]?.name;
}

export async function removeTeamMember(
  dbClient: postgres.QueryClient,
  teamMembership: Owner<string>,
  ownerId: string,
  userId: string,
): Promise<Result<RemoveUserOutcome, null>> {
  const transaction = dbClient.createTransaction("remove_team_member_txn");
  await transaction.begin();
  try {
    const deleteResult = await transaction.queryObject`
      DELETE FROM user_teams
      WHERE user_id = ${userId}
        AND team_id = ${teamMembership.val}
      RETURNING id
    `;

    if (deleteResult.rowCount === 0) {
      await transaction.rollback();
      return success("user-not-in-team");
    }

    await transaction.queryObject`
      UPDATE apiKeys
      SET user_id = ${ownerId}
      WHERE user_id = ${userId}
    `;

    await transaction.queryObject`
      UPDATE users
      SET stripe_customer_id = NULL,
          subscription_is_valid = NULL
      WHERE id = ${userId}
    `;

    await transaction.commit();
    return success("remove-success");
  } catch (error) {
    console.log("Error removing team member");
    console.log(error);
    await transaction.rollback();
    return fail(null);
  }
}

export async function determineInvitability(
  dbClient: postgres.QueryClient,
  teamMembership: Membership<string>,
  inviteeEmail: string,
): Promise<Invitability> {
  const result = await dbClient.queryObject<InvitabilityPropertiesRow>`
  select
    user_teams.team_id,
    search.email AS invitee_email,
    invites.updated_at <= now() - interval '1 hour' AS is_reinvitable
  from (select ${inviteeEmail} as email) as search
  left join users
    on users.email = search.email
  left join user_teams
    on user_teams.user_id = users.id
  left join invites
    on invites.invitee_email = search.email
    and invites.team_id = ${teamMembership.val};
  `;
  const row = result.rows[0];

  if (row.team_id) {
    return {
      type: "already-on-team",
      teamId: row.team_id,
    };
  }
  if (row.is_reinvitable == false) {
    return "too-many-invites";
  }
  return {
    type: "invitable",
    email: row.invitee_email,
  };
}
