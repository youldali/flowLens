import { useRuntimeHost } from '@common/runtimeHost'
import { FromCli } from './FromCli'
import { FromVsCode } from './FromVsCode'

export function GraphView() {
  const runtimeHost = useRuntimeHost()

  return runtimeHost === 'vscode' ? <FromVsCode /> : <FromCli />
}
