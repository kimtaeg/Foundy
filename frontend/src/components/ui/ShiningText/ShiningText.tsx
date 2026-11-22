export interface ShiningTextProps {
  text: string;
  className?: string;
}

/** Light sweep inspired by 21st.dev / HextaUI's Shining Text. */
export function ShiningText({ text, className = "" }: ShiningTextProps) {
  return <span data-shining-text className={`foundy-shining-text ${className}`}>{text}</span>;
}
