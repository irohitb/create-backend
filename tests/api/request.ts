export function buildApiRequest(
  method: "GET" | "POST" | "PUT" | "DELETE",
  body?: object,
  searchParams?: Record<string, string>,
): Request {
  const url = new URL("http://localhost");

  if (searchParams) {
    Object.entries(searchParams).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });
  }

  return new Request(url.toString(), {
    method,
    body: body ? JSON.stringify(body) : body,
  });
}
