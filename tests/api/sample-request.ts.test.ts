import { assertEquals } from "https://deno.land/std@0.219.0/assert/assert_equals.ts";
import { getHelloWorldResponse, manageSamplePostRequest } from "../../endpoints/api/example.ts";
import { assertIsSuccess } from "../result-asserts.ts";
import { testEnv } from "../utils.ts";
import { buildApiRequest } from "./request.ts";

Deno.test("Backed prints Hello World",  async (_t) => {
    const response = await getHelloWorldResponse(buildApiRequest("GET"), testEnv)
    assertIsSuccess(response);
    assertEquals(response.data, "Hello world")
})


Deno.test("Return response sent", async (_t) => {
    const response = await manageSamplePostRequest(buildApiRequest("POST", {
        word: "hello"
    }))
    assertIsSuccess(response);
    assertEquals(response.data, "hello")
})