import { ArrowUpRight, Radio, Zap, Upload } from "lucide-react";
export function ModeCards({ onSelect }: { onSelect: (page: string) => void }) {
  const modes = [
    {
      name: "Offline LAN",
      description: "Same network. Zero internet.",
      caption: "ONE HOST. ALL YOUR DEVICES.",
      Icon: Radio,
    },
    {
      name: "Online Share",
      description: "Direct browser sharing.",
      caption: "PRIVATE ROOMS & INVITATIONS",
      Icon: Zap,
    },
    {
      name: "Send Later",
      description: "Share on their schedule.",
      caption: "ENCRYPTED EXPIRING LINKS",
      Icon: Upload,
    },
  ];
  return (
    <div className="cards">
      {modes.map(({ name, description, caption, Icon }) => (
        <button
          type="button"
          key={name}
          className="card"
          onClick={() => onSelect(name)}
        >
          <Icon size={26} />
          <ArrowUpRight className="arrow" />
          <h3>{name}</h3>
          <p>{description}</p>
          <small>{caption}</small>
        </button>
      ))}
    </div>
  );
}
