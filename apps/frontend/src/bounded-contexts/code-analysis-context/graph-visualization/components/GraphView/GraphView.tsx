import { useConfig } from '@common/config'
import { FromCli } from './FromCli'
import { FromVsCode } from './FromVsCode'

export function GraphView() {
  const { runtimeHost } = useConfig()

  return runtimeHost === 'vscode' ? <FromVsCode /> : <FromCli />
}
