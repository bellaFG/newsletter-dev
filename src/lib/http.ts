export const jsonHeaders = { 'Content-Type': 'application/json' }

export function redirect(location: string): Response {
  return new Response(null, {
    status: 303,
    headers: { Location: location },
  })
}
