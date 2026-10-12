import { useMemo } from "react";
import { errorText } from "../../ipc/errors";
import { useScenes } from "../../store";
import { Message } from "../home/Message";

/** Last refused scene operation (a scene already running, a refused file…): the one message. */
export function SceneToast() {
  const error = useScenes((s) => s.lastError);
  const clear = useScenes((s) => s.clearError);
  const content = useMemo(() => (error ? { id: error, text: errorText(error) } : null), [error]);
  return <Message content={content} onClose={clear} />;
}
