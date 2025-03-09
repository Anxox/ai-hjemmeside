export async function POST(req: Request) {
  const { question } = await req.json();
  const res = await fetch("http://localhost:5000/ask", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question }),
  });
  const data = await res.json();
  return Response.json(data);
}
