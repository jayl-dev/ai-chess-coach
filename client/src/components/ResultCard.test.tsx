import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MOCK_ANALYSIS_RESULT } from "../data/mockAnalysis";
import { ResultCard } from "./ResultCard";

describe("ResultCard", () => {
  it("renders analysis fixture content and enabled board guidance", () => {
    render(<ResultCard result={MOCK_ANALYSIS_RESULT} showArrow={true} showHighlights={true} />);

    expect(screen.getByText(/Best move:/)).toHaveTextContent(MOCK_ANALYSIS_RESULT.bestMove.san);
    expect(screen.getByText(MOCK_ANALYSIS_RESULT.explanation)).toBeInTheDocument();
    expect(screen.getByTestId("move-arrow")).toBeInTheDocument();
    expect(screen.getByTestId("move-highlights")).toBeInTheDocument();
  });

  it("hides board guidance when visual settings are disabled", () => {
    render(<ResultCard result={MOCK_ANALYSIS_RESULT} showArrow={false} showHighlights={false} />);

    expect(screen.queryByTestId("move-arrow")).not.toBeInTheDocument();
    expect(screen.queryByTestId("move-highlights")).not.toBeInTheDocument();
  });
});
