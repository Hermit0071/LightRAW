import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { describe, expect, it, vi } from "vitest";
import { createLibraryPhoto } from "../library/catalog";
import { Filmstrip } from "./Filmstrip";
import { WorkspaceNavigator } from "./WorkspaceNavigator";

describe("workspace controls", () => {
  it("changes catalog collection and theme through real buttons", () => {
    const onCollection = vi.fn();
    const onTheme = vi.fn();
    let renderer: ReactTestRenderer;
    act(() => {
      renderer = create(<WorkspaceNavigator collection="all" total={4} rated={2} selected={1} theme="dark"
        onCollection={onCollection} onTheme={onTheme} />);
    });
    const buttons = renderer!.root.findAllByType("button");
    act(() => buttons[1].props.onClick());
    act(() => buttons[4].props.onClick());
    expect(onCollection).toHaveBeenCalledWith("rated");
    expect(onTheme).toHaveBeenCalledWith("grey");
  });

  it("opens the selected filmstrip photo", () => {
    const photo = createLibraryPhoto({ path: "/a.jpg", fileName: "a.jpg", sourceWidth: 10, sourceHeight: 10, format: "JPEG", camera: null }, "a");
    const onOpen = vi.fn();
    let renderer: ReactTestRenderer;
    act(() => { renderer = create(<Filmstrip photos={[photo]} activeId={null} onOpen={onOpen} />); });
    act(() => renderer!.root.findByType("button").props.onClick());
    expect(onOpen).toHaveBeenCalledWith(photo);
  });
});
