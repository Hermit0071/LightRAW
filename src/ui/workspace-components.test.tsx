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
      renderer = create(<WorkspaceNavigator collection="all" total={4} rated={2} selected={1} theme="dark" gpuStatus="ready"
        onCollection={onCollection} onTheme={onTheme} />);
    });
    act(() => renderer!.root.findByProps({ "aria-label": "已评分" }).props.onClick());
    act(() => renderer!.root.findByProps({ "aria-label": "grey 主题" }).props.onClick());
    expect(onCollection).toHaveBeenCalledWith("rated");
    expect(onTheme).toHaveBeenCalledWith("grey");
    act(() => renderer!.update(<WorkspaceNavigator collection="all" total={4} rated={2} selected={1} theme="dark" gpuStatus="error"
      onCollection={onCollection} onTheme={onTheme} />));
    expect(JSON.stringify(renderer!.toJSON())).toContain("GPU 不可用");
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
