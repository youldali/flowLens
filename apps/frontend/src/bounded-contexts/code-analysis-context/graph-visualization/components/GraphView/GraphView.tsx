import { useConfig } from '#common/config/index.ts'
import { FromCli } from './FromCli'
import { FromVsCode } from './FromVsCode'

export function GraphView() {
  const { runtimeHost } = useConfig()

  return runtimeHost === 'vscode' ? <FromVsCode /> : <FromCli />
}
