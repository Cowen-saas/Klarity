interface LacuneBarProps {
  notion: string;
  niveauMaitrise: number;
}

function couleurBarre(niveau: number): string {
  if (niveau < 40) return "bg-danger";
  if (niveau < 70) return "bg-accent";
  return "bg-success";
}

export function LacuneBar({ notion, niveauMaitrise }: LacuneBarProps) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <p className="text-sm font-semibold text-texte">{notion}</p>
        <p className="text-sm font-bold text-texte">{niveauMaitrise}%</p>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-fond">
        <div className={`h-full rounded-full ${couleurBarre(niveauMaitrise)}`} style={{ width: `${niveauMaitrise}%` }} />
      </div>
    </div>
  );
}
