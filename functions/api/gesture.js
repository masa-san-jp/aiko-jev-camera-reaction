// Cloudflare Pages Function. Served at /api/gesture on the same origin as the
// static site, so the browser never needs cross-origin requests or a separate
// host for the proxy. The Jev API key lives only in the Pages project's
// environment (wrangler pages secret put TYPESAFE_API_KEY) and never reaches
// the client bundle.

// Jev only arbitrates face-based reactions (tilt vs. look-into vs. none) — a genuinely
// judgment-heavy call. A raised hand is handled before Jev is even called (see
// pickWaveReaction below): asking Jev "is this really a wave" came back inconsistent and
// left-right-asymmetric even for a plainly off-center static hand (2026-10-04 testing).
// Left/right side (for both wave and tilt) is picked with plain arithmetic, not asked of
// Jev — a median-x / angle-sign check is 100% deterministic and exactly as reliable as the
// data, whereas Jev's left/right choice calls kept coming back reversed or asymmetric.
const REACTION_CRITERIA = {
  // Lower bar (was +-12, tight) — most people can't tilt both directions equally far,
  // so a tight cutoff let one side work and starved the other (2026-10-04 feedback).
  tilt: '顔の両目を結ぶ線の角度 eyeAngleDegrees の絶対値が、7度よりもはっきり大きい。',
  // Open-ended "more than" wording and a lower bar — a tight numeric band made Jev's
  // confidence drop for ratios well past the stated cutoff instead of rising.
  'look-into': '顔の高さ比率 heightRatio が 1 より明確に大きい（例: 1.15以上）。普段よりカメラに近づいているほど、より強くこれに当てはまる。',
  none: '上記のどれにも明確に当てはまらない。動きが小さい、または判断材料が不十分。',
};

// The user's own camera preview is mirrored (CSS), but Aiko's reaction video is not, so a
// hand/tilt on the left side of the user's own mirrored view must play the file whose label
// matches Aiko's own left/right from the viewer's seat, not a literal "same screen side" —
// verified empirically on 2026-10-04 (previous literal mapping read reversed to users).
function pickWaveReaction(hands) {
  const points = (hands ?? []).flatMap((hand) => hand.points ?? []);
  if (!points.length) return null;
  const xs = points.map((point) => point.x).sort((a, b) => a - b);
  const median = xs[Math.floor(xs.length / 2)];
  if (median >= 0.45 && median <= 0.55) return null;
  return median < 0.45 ? 'wave-right' : 'wave-left';
}

function pickTiltReaction(face) {
  if (!face || Math.abs(face.eyeAngleDegrees) < 3) return null;
  return face.eyeAngleDegrees > 0 ? 'tilt-left' : 'tilt-right';
}

export async function onRequestPost({ request, env }) {
  if (!env.TYPESAFE_API_KEY) return json({ error: 'server misconfigured' }, 500);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'invalid JSON body' }, 400);
  }
  if (!body || typeof body.state !== 'object' || body.state === null) return json({ error: 'state is required' }, 400);

  // A hand in frame is taken as a wave outright — no Jev call for this one. Asking Jev
  // "is this really a wave" repeatedly came back inconsistent/left-right-asymmetric even
  // for a plainly off-center static hand (2026-10-04 testing), and the user explicitly
  // asked for "hand raised = good enough" instead of chasing that judgment call further.
  const waveReaction = pickWaveReaction(body.state.hands);
  if (waveReaction) return json({ reaction: waveReaction, confidence: 1 });

  const upstream = await fetch('https://api.typesafe.ai/v1/systemone', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.TYPESAFE_API_KEY}` },
    body: JSON.stringify({
      state: body.state,
      model: 'jev-latest',
      questions: {
        category: {
          type: 'choice',
          instructions: '与えられた手首の軌跡（hands）と顔の角度・距離（face）の記録から、今アイコに向けてどの種類のジェスチャーが行われているか判定してください。',
          criteria: REACTION_CRITERIA,
        },
      },
    }),
  });

  if (!upstream.ok) {
    console.error('Jev request failed', upstream.status, await upstream.text().catch(() => ''));
    return json({ error: 'Jev classification failed' }, 502);
  }

  const result = await upstream.json();
  const answer = result?.answers?.category;
  if (!answer) return json({ error: 'Jev classification failed' }, 502);

  let reaction = null;
  if (answer.choice === 'tilt') reaction = pickTiltReaction(body.state.face);
  else if (answer.choice === 'look-into') reaction = 'look-into';

  return json({ reaction, confidence: answer.confidence });
}

export async function onRequestOptions() {
  return new Response(null, { status: 204 });
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}
