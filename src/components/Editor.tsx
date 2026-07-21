import { useMemo } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { python } from "@codemirror/lang-python";
import { EditorView, keymap } from "@codemirror/view";
import { indentWithTab } from "@codemirror/commands";
import { Prec } from "@codemirror/state";

interface Props {
  value: string;
  onChange: (v: string) => void;
  onRun: () => void;
  readOnly?: boolean;
}

export default function Editor({ value, onChange, onRun, readOnly }: Props) {
  const extensions = useMemo(
    () => [
      python(),
      EditorView.lineWrapping,
      keymap.of([indentWithTab]),
      Prec.highest(
        keymap.of([
          {
            key: "Mod-Enter",
            preventDefault: true,
            run: () => {
              onRun();
              return true;
            },
          },
        ]),
      ),
    ],
    [onRun],
  );

  return (
    <CodeMirror
      value={value}
      onChange={onChange}
      extensions={extensions}
      readOnly={readOnly}
      className="h-full"
      basicSetup={{
        lineNumbers: true,
        foldGutter: false,
        autocompletion: true,
        bracketMatching: true,
        closeBrackets: true,
        highlightActiveLine: true,
        tabSize: 4,
      }}
    />
  );
}
