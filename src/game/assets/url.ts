/** Works at the domain root and in a GitHub Pages repository subdirectory. */
export function assetUrl(path: string) {
  return `${import.meta.env?.BASE_URL ?? '/'}${path.replace(/^\//, '')}`;
}
