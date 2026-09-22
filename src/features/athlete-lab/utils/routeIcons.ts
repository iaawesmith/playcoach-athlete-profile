import { supabase } from "@/integrations/supabase/client";

function routeAssetUrl(fileName: string): string {
  return supabase.storage.from("athlete-media").getPublicUrl(`route-icons/${fileName}`).data.publicUrl;
}

export const ROUTE_ICON_ASSETS = {
  Slant: routeAssetUrl("slant.art.png"),
  Cross: routeAssetUrl("cross.art.png"),
  Out: routeAssetUrl("out.art.png"),
  In: routeAssetUrl("in.art.png"),
  Curl: routeAssetUrl("curl.art.png"),
  Comeback: routeAssetUrl("comeback.art.png"),
  Corner: routeAssetUrl("corner.art.png"),
  Post: routeAssetUrl("post.art.png"),
  Wheel: routeAssetUrl("wheel.art.png"),
  Go: routeAssetUrl("go.art.png"),
} as const;

export type MappedRouteName = keyof typeof ROUTE_ICON_ASSETS;

function normalizeRouteName(name: string): string {
  return name.trim().replace(/\s+route$/i, "").trim().toLowerCase();
}

const ROUTE_NAME_LOOKUP = Object.fromEntries(
  Object.keys(ROUTE_ICON_ASSETS).map((routeName) => [normalizeRouteName(routeName), routeName]),
) as Record<string, MappedRouteName>;

export function getMappedRouteName(nodeName: string): MappedRouteName | null {
  return ROUTE_NAME_LOOKUP[normalizeRouteName(nodeName)] ?? null;
}

export function getRouteIconUrl(nodeName: string): string | null {
  const routeName = getMappedRouteName(nodeName);
  return routeName ? ROUTE_ICON_ASSETS[routeName] : null;
}

export function resolveNodeIcon(nodeName: string, storedIconUrl: string | null): string | null {
  return getRouteIconUrl(nodeName) ?? storedIconUrl;
}