import type { GrantPosterMotif } from "@/components/grants/GrantPoster/poster-motif";
import styles from "./GrantPosterArtwork.module.css";

export interface GrantPosterArtworkProps {
  motif?: GrantPosterMotif;
}

export function GrantPosterArtwork({ motif = "book" }: GrantPosterArtworkProps) {
  return (
    <div aria-hidden="true" className={`${styles.art} ${styles[motif]}`}>
      <span /><span /><span />
    </div>
  );
}
