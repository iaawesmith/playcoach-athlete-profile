
-- Create athlete_lab_nodes table
CREATE TABLE public.athlete_lab_nodes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  icon_url TEXT,
  overview TEXT NOT NULL DEFAULT '',
  pro_mechanics TEXT NOT NULL DEFAULT '',
  key_metrics JSONB NOT NULL DEFAULT '[]'::jsonb,
  scoring_rules TEXT NOT NULL DEFAULT '',
  common_errors JSONB NOT NULL DEFAULT '[]'::jsonb,
  phase_breakdown JSONB NOT NULL DEFAULT '[]'::jsonb,
  reference_object TEXT NOT NULL DEFAULT '',
  camera_guidelines TEXT NOT NULL DEFAULT '',
  form_checkpoints JSONB NOT NULL DEFAULT '[]'::jsonb,
  llm_prompt_template TEXT NOT NULL DEFAULT '',
  badges JSONB NOT NULL DEFAULT '[]'::jsonb,
  elite_videos JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- No RLS needed for admin-only portal
ALTER TABLE public.athlete_lab_nodes ENABLE ROW LEVEL SECURITY;

-- Allow all operations (admin portal, no auth yet)
CREATE POLICY "Allow all access to athlete_lab_nodes"
  ON public.athlete_lab_nodes
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.update_athlete_lab_nodes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_athlete_lab_nodes_updated_at
  BEFORE UPDATE ON public.athlete_lab_nodes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_athlete_lab_nodes_updated_at();

-- Seed default Slant Route node
INSERT INTO public.athlete_lab_nodes (name, overview, pro_mechanics, key_metrics, scoring_rules, common_errors, phase_breakdown, reference_object, camera_guidelines, form_checkpoints, llm_prompt_template, badges, elite_videos)
VALUES (
  'Slant Route',
  'The slant route is a quick-hitting interior route where the receiver takes 1-3 steps off the line before breaking sharply at a 45-degree angle toward the middle of the field. It exploits soft coverage and is a staple of the quick-game passing attack.',
  'Release: Explosive first step, attack the outside shoulder of the DB to create leverage. Sell vertical for 2-3 steps with full-speed stem. Break: Plant hard on the outside foot at a 45° angle — no rounding. Hands stay tight to the body through the break. Head snaps to the QB at the break point. Catch: Eyes track the ball into the tuck. Secure with hands, not body. Expect contact — brace core through the catch window. After catch: Immediately turn upfield. Do not drift laterally after the catch.',
  '[
    {"name": "Break Angle", "description": "Measured angle of the cut at the break point using hip and knee keypoints. Should be close to 45°.", "eliteTarget": "45", "unit": "degrees", "weight": 25},
    {"name": "Separation Distance", "description": "Distance between receiver and nearest defender at the catch point, measured via torso keypoints.", "eliteTarget": "2.5", "unit": "yards", "weight": 20},
    {"name": "Release Speed", "description": "Average velocity during the first 3 steps off the line, calculated from ankle keypoint displacement per frame.", "eliteTarget": "18", "unit": "mph", "weight": 15},
    {"name": "Head Snap Timing", "description": "Frame count between the plant foot hitting the ground and the head rotating toward the QB. Lower is better.", "eliteTarget": "3", "unit": "frames", "weight": 15},
    {"name": "Catch Efficiency", "description": "Hand position relative to the ball at the catch frame. Measures whether the catch was made with hands extended vs body catch.", "eliteTarget": "95", "unit": "%", "weight": 15},
    {"name": "Post-Catch YAC Burst", "description": "Acceleration in the 5 frames after securing the catch, measured from hip keypoint velocity change.", "eliteTarget": "4.2", "unit": "mph/s", "weight": 10}
  ]'::jsonb,
  'Route Mastery Score = weighted average of all key metrics. Each metric is scored 0–100 relative to elite target, then multiplied by its weight percentage. Final score is the sum of weighted scores. Example: if Break Angle scores 85/100 at 25% weight, it contributes 21.25 to the total.',
  '[
    {"error": "Rounding the break", "correction": "Plant hard on the outside foot. Drive the inside knee toward the target. The cut should be angular, not curved. Drill: cone-to-cone 45° cuts at full speed."},
    {"error": "Tipping the route with eyes", "correction": "Keep eyes downfield during the stem. Do not look at the QB before the break point. The head snap happens AT the break, not before."},
    {"error": "Slowing down before the break", "correction": "Maintain full speed through the stem. The deceleration should be a single-step plant, not a gradual slowdown. Think: accelerate INTO the break."},
    {"error": "Body catch", "correction": "Extend hands to the ball. Create a diamond window with thumbs and index fingers. Catch the point of the ball, not the body of the ball."},
    {"error": "Drifting after the catch", "correction": "Immediately turn shoulders upfield after securing the ball. Get north-south. Every lateral step after the catch is a wasted step."}
  ]'::jsonb,
  '[
    {"phase": "Release", "notes": "First 2-3 steps off the line. Must be explosive and sell vertical. Attack the DB outside shoulder to create inside leverage. Full speed, no false steps."},
    {"phase": "Stem", "notes": "Vertical push for 5-7 yards (varies by play design). Maintain speed and keep defender on your back hip. Eyes stay downfield."},
    {"phase": "Break", "notes": "The critical moment. Hard plant on outside foot at 45°. No rounding. Head snaps to QB simultaneously. Hands come tight to body through the turn."},
    {"phase": "Catch Window", "notes": "2-3 steps after the break. Ball should arrive here. Hands extended, diamond catch position. Expect contact from LB/safety."},
    {"phase": "YAC (After Catch)", "notes": "Immediately turn upfield. Tuck ball, protect it. Burst through contact. This is where slant routes become big plays."}
  ]'::jsonb,
  'Place a standard sheet of printer paper (8.5" x 11") flat on the ground at the break point. This gives the AI a known reference for distance calibration. Alternatively, if on a lined field, the 5-yard markers serve as calibration references.',
  'Primary angle: sideline camera, perpendicular to the line of scrimmage, 10-15 yards from the route. Elevation: slightly elevated (bleacher level or tripod at 8+ feet) is ideal. Secondary angle (optional): end zone camera for break angle verification. Avoid: behind-the-QB angle — it compresses the route and makes angle measurement inaccurate.',
  '["Initial alignment stance and foot position", "First step explosion off the line", "Stem speed at full velocity (frame before break)", "Plant foot position at the break point", "Hip rotation angle through the break", "Head snap timing (frame of head turn)", "Hand position at catch point", "Ball security through contact", "First step after catch (upfield vs lateral)"]'::jsonb,
  'You are an elite NFL wide receiver coach analyzing a slant route drill. Your tone is direct, constructive, and encouraging — like a position coach who believes in the athlete but demands precision. Structure your feedback as: 1) Overall Score and one-line verdict, 2) Phase-by-phase breakdown with specific observations, 3) Top 2 strengths with timestamps, 4) Top 2 areas for improvement with specific drills to fix them, 5) Comparison to elite benchmark. Never be generic. Reference specific frames and measurements. End with a motivating call to action.',
  '[
    {"name": "Elite Break", "condition": "Break Angle score >= 90 on 3 consecutive attempts"},
    {"name": "Quick Hands", "condition": "Catch Efficiency >= 95 on 5 attempts"},
    {"name": "Route Technician", "condition": "Overall Route Mastery Score >= 85"},
    {"name": "YAC Machine", "condition": "Post-Catch YAC Burst >= 4.0 mph/s on 3 attempts"},
    {"name": "Slant Master", "condition": "Overall Route Mastery Score >= 95"}
  ]'::jsonb,
  '[
    {"url": "https://www.youtube.com/watch?v=example1", "label": "Tyreek Hill - Slant Route Breakdown"},
    {"url": "https://www.youtube.com/watch?v=example2", "label": "Davante Adams - Slant Release Technique"},
    {"url": "https://www.youtube.com/watch?v=example3", "label": "NFL Films - Best Slant Routes 2024"}
  ]'::jsonb
);
