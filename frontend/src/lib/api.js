const API_BASE = import.meta.env.VITE_API_URL || '/api';

export async function extractArticle(url) {
  const res = await fetch(`${API_BASE}/extract`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || 'Erro desconhecido na requisição.');
  }
  return res.json();
}
