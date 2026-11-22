import { Fragment } from "react";

export interface MessageTextProps { text: string }

export function MessageText({ text }: MessageTextProps) {
  return (
    <>
      {text.split("\n").map((line, index) => (
        <Fragment key={index}>
          {index > 0 && <br />}
          {line}
        </Fragment>
      ))}
    </>
  );
}
