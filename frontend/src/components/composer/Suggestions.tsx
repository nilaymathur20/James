import React from "react";

interface SuggestionsProps {
  onSelect: (command: string) => void;
}

export const Suggestions: React.FC<SuggestionsProps> = ({ onSelect }) => {
  return (
    <section className="suggestions" aria-label="Example commands">
      <button type="button" onClick={() => onSelect("/audio lofi chill beat")}>
        /audio
      </button>
      <button type="button" onClick={() => onSelect("/video cyber city at night")}>
        /video
      </button>
      <button type="button" onClick={() => onSelect("search API configuration")}>
        Search files
      </button>
      <button type="button" onClick={() => onSelect("index ~/Documents")}>
        Index Documents
      </button>
      <button type="button" onClick={() => onSelect("open README")}>
        Find a file
      </button>
      <button type="button" onClick={() => onSelect("help")}>
        Commands
      </button>
    </section>
  );
};
