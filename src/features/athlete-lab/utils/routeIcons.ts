import comebackIconAsset from "@/assets/route-icons/comeback.art.png.asset.json";
import cornerIconAsset from "@/assets/route-icons/corner.art.png.asset.json";
import crossIconAsset from "@/assets/route-icons/cross.art.png.asset.json";
import curlIconAsset from "@/assets/route-icons/curl.art.png.asset.json";
import goIconAsset from "@/assets/route-icons/go.art.png.asset.json";
import inIconAsset from "@/assets/route-icons/in.art.png.asset.json";
import outIconAsset from "@/assets/route-icons/out.art.png.asset.json";
import postIconAsset from "@/assets/route-icons/post.art.png.asset.json";
import slantIconAsset from "@/assets/route-icons/slant.art.png.asset.json";
import wheelIconAsset from "@/assets/route-icons/wheel.art.png.asset.json";

export const ROUTE_ICON_ASSETS = {
  Slant: slantIconAsset.url,
  Cross: crossIconAsset.url,
  Out: outIconAsset.url,
  In: inIconAsset.url,
  Curl: curlIconAsset.url,
  Comeback: comebackIconAsset.url,
  Corner: cornerIconAsset.url,
  Post: postIconAsset.url,
  Wheel: wheelIconAsset.url,
  Go: goIconAsset.url,
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