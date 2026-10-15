import { ArrowUpRight, Radio, Zap, Upload } from "lucide-react";
export function ModeCards({
  onSelect,
  offlineOnly = false,
}: {
  onSelect: (page: string) => void;
  offlineOnly?: boolean;
}) {
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
    {
      name: "Optical Share",
      description: "Screen-to-camera text and small files.",
      caption: "NO NETWORK AFTER LOADING",
      Icon: Radio,
    },
    {
      name: "Send Later — Coming Soon",
      description: "Future encrypted temporary links.",
      caption: "COMING SOON",
      Icon: Upload,
    },
    {
      name: "Offline Text Sharing",
      description: "Text, links and code on your LAN.",
      caption: "APPROVED DEVICES ONLY",
      Icon: Radio,
    },
  ];
  return (
    <div className="cards">
      {modes
        .filter((mode) =>
          offlineOnly
            ? [
                "Offline LAN",
                "Offline Text Sharing",
                "Optical Share",
                "Send Later — Coming Soon",
              ].includes(mode.name)
            : ![
                "Offline Text Sharing",
                "Send Later — Coming Soon",
                "Optical Share",
              ].includes(mode.name),
        )
        .map(({ name, description, caption, Icon }) => (
          <button
            type="button"
            key={name}
            className="card"
            onClick={() =>
              onSelect(
                name === "Optical Share"
                  ? "Optical Text"
                  : name === "Offline Text Sharing"
                    ? "Share Text"
                    : name,
              )
            }
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
