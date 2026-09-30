export function openCliSource(filePath: string, offset: number): void {
  const url = new URL('/source', window.location.origin)
  url.searchParams.set('filePath', filePath)
  url.searchParams.set('offset', String(offset))
  url.hash = 'selected'
  window.open(url.toString(), '_blank', 'noopener')
}
