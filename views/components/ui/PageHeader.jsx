// En-tête de page commun : sur-titre (couleur d'accent), titre, description et actions alignées à droite.
export default function PageHeader({ eyebrow, title, description, actions }) {
  return (
    <header className="flex flex-col gap-4 border-b border-tw-line pb-6 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-tw-accent">{eyebrow}</p>}
        <h1 className="mt-1.5 text-[28px] font-semibold leading-tight tracking-[-0.02em]">{title}</h1>
        {description && <p className="mt-2 max-w-2xl text-sm leading-relaxed text-tw-muted">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </header>
  );
}
