import { JsonViewer } from "../chat/json-viewer.tsx";

export function RawJsonView({ json }: { json: unknown }) {
  return <JsonViewer data={json} />;
}
