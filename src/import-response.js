// Platform errors (missing functions, protection, timeouts) may return HTML/text.
// Never display or log the raw response body.
export async function readImportResponse(response) {
  const unavailable = `Dilemma's API is unavailable (HTTP ${response.status}). Please try again later.`;
  const missing = 'Dilemma’s import API was not deployed. Check the Vercel project root and redeploy the full project.';
  if (!response.headers.get('content-type')?.includes('application/json')) {
    throw new Error(response.status === 404 ? missing : unavailable);
  }
  let data;
  try { data = await response.json(); } catch { throw new Error(unavailable); }
  if (!response.ok) throw new Error(typeof data?.error === 'string' ? data.error : unavailable);
  if (!data?.vehicle || typeof data.vehicle.legacyItemId !== 'string'
      || !Array.isArray(data.vehicle.images) || !Array.isArray(data.vehicle.itemSpecifics)) {
    throw new Error('Dilemma returned an invalid listing response. Please try again later.');
  }
  return data;
}
