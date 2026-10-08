import React, { useState } from "react";
import type { ReActStep } from "@/types";
import { ChevronDownIcon, ChevronUpIcon } from "@/icons";

interface ThoughtStreamProps {
  steps?: ReActStep[];
  thought?: string;
}

export const ThoughtStream: React.FC<ThoughtStreamProps> = ({ steps, thought }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!thought && (!steps || steps.length === 0)) {
    return null;
  }

  return (
    <div className="thought-stream-container">
      <button
        type="button"
        className="thought-stream-toggle"
        onClick={() => setIsExpanded(!isExpanded)}
        aria-expanded={isExpanded}
      >
        <span className="thought-icon">
          {isExpanded ? <ChevronDownIcon size={13} /> : <ChevronUpIcon size={13} />}
        </span>
        <span className="thought-label">
          {steps && steps.length > 0
            ? `ReAct Reasoning (${steps.length} step${steps.length === 1 ? "" : "s"})`
            : "Thinking Process"}
        </span>
      </button>

      {isExpanded && (
        <div className="thought-stream-content">
          {thought && <p className="thought-text">{thought}</p>}
          {steps?.map((step) => (
            <div key={step.step} className="react-step">
              <div className="step-header">
                <span className="step-number">Step {step.step}</span>
                {step.action && <span className="step-action-badge">{step.action.tool}</span>}
              </div>
              {step.thought && <p className="step-thought">{step.thought}</p>}
              {step.action && (
                <pre className="step-params">{JSON.stringify(step.action.params, null, 2)}</pre>
              )}
              {step.observation && (
                <div className="step-observation">
                  <strong>Observation:</strong>
                  <pre>{step.observation}</pre>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};