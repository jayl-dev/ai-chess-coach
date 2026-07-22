import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MOCK_ANALYSIS_ERROR } from "../data/mockAnalysis";
import { DEFAULT_SETTINGS } from "../state/settings";
import HomeRoute from "./HomeRoute";

function renderHome(outcome: "success" | "error") {
  return render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <HomeRoute settings={DEFAULT_SETTINGS} captureDelayMs={50} mockOutcome={outcome} />
    </MemoryRouter>,
  );
}

describe("HomeRoute capture flow", () => {
  afterEach(() => {
    vi.useRealTimers();
    window.localStorage.clear();
  });

  it("moves from ready through loading to a typed result using the keyboard", () => {
    vi.useFakeTimers();
    renderHome("success");

    fireEvent.click(screen.getByRole("button", { name: "Switch to monitor mode" }));
    fireEvent.click(screen.getByRole("switch", { name: /white moves next/i }));
    const capture = screen.getByRole("button", { name: "Capture screenshot" });
    fireEvent.keyDown(capture, { key: "Enter" });

    expect(screen.getByRole("status")).toHaveTextContent("Capturing board");
    act(() => vi.advanceTimersByTime(50));

    expect(screen.getByText(/Best move:/)).toBeInTheDocument();
    expect(screen.getByLabelText("Chess position, black at bottom")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Capture another screenshot" })).toBeInTheDocument();
  });

  it("shows an actionable error fixture and supports retry", () => {
    vi.useFakeTimers();
    renderHome("error");

    fireEvent.click(screen.getByRole("button", { name: "Switch to monitor mode" }));
    fireEvent.click(screen.getByRole("button", { name: "Capture screenshot" }));
    act(() => vi.advanceTimersByTime(50));

    expect(screen.getByRole("alert")).toHaveTextContent(MOCK_ANALYSIS_ERROR.title);
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(screen.getByRole("status")).toHaveTextContent("Capturing board");
  });
});
