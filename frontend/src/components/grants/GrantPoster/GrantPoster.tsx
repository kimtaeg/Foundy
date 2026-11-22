import { GrantPosterArtwork } from "@/components/grants/GrantPosterArtwork";
import { grantDisplay } from "@/lib/grants/format-grant";
import type { Grant } from "@/types/grants";
import styles from "./GrantPoster.module.css";
import { posterTheme } from "./poster-motif";

export interface GrantPosterProps {
  grant: Grant;
  variant?: "card" | "detail";
  big?: boolean;
}

export function GrantPoster({ grant, big = false, variant = "card" }: GrantPosterProps) {
  const { title } = grantDisplay(grant);
  const { motif, palette } = posterTheme(grant);
  return (
    <header
      className={`${styles.poster} ${big ? styles.large : ""}`}
      data-grant-poster={grant.id}
      data-motif={motif}
      data-palette={palette}
    >
      <div className={styles.copy}>
        <p className={styles.metadata}>{[grant.cat, grant.region].filter(Boolean).join(" · ")}</p>
        <div className="min-w-0">
          <h3 className={styles.title}>{title}</h3>
          {variant === "detail" && grant.amount && (
            <p className="mb-0 mt-2 break-keep text-base font-semibold leading-snug [overflow-wrap:anywhere] sm:text-lg">
              <span className="sr-only">지원 규모 </span>{grant.amount}
            </p>
          )}
        </div>
      </div>
      <GrantPosterArtwork motif={motif} />
    </header>
  );
}
