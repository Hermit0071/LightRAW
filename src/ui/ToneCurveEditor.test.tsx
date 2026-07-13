import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { describe, expect, it, vi } from "vitest";
import { createDefaultToneCurves, type ToneCurves } from "../editor/tone-curve";
import { ToneCurveEditor } from "./ToneCurveEditor";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("ToneCurveEditor", () => {
  it("keeps dragging outside the graph until the captured pointer is released", () => {
    const setPointerCapture = vi.fn();
    const releasePointerCapture = vi.fn();
    const svg = {
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 240, height: 150 }),
      setPointerCapture,
      hasPointerCapture: () => true,
      releasePointerCapture,
    };
    const onChange = vi.fn<(curves: ToneCurves) => void>();
    let renderer: ReactTestRenderer;
    act(() => {
      renderer = create(<ToneCurveEditor curves={createDefaultToneCurves()} disabled={false} onChange={onChange} />, {
        createNodeMock: (element) => element.type === "svg" ? svg : {},
      });
    });

    const graph = renderer!.root.findByType("svg");
    const firstHandle = renderer!.root.findAllByType("circle")[0];
    act(() => firstHandle.props.onPointerDown({ pointerId: 7, stopPropagation: vi.fn() }));
    act(() => graph.props.onPointerMove({ pointerId: 7, clientX: 300, clientY: -50 }));

    expect(setPointerCapture).toHaveBeenCalledWith(7);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0].master[0]).toEqual({ x: 0, y: 1 });

    act(() => graph.props.onPointerUp({ pointerId: 7, currentTarget: svg }));
    act(() => graph.props.onPointerMove({ pointerId: 7, clientX: 120, clientY: 75 }));
    expect(releasePointerCapture).toHaveBeenCalledWith(7);
    expect(onChange).toHaveBeenCalledTimes(1);

    act(() => renderer!.unmount());
  });
});
