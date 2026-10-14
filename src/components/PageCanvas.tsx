import { useEffect, useRef, useState } from "react";
import {
  Stage,
  Layer,
  Rect,
  Group,
  Ellipse,
  Line,
  Image as KImage,
  Transformer,
  Shape,
  Text,
} from "react-konva";
import Konva from "konva";
import {
  backgroundPlacement,
  getPageBackground,
  isLeftPage,
  type BookObject,
  type Project,
} from "../core/model";
import {
  type LayoutPage,
  type TextLine,
  textBoxLines,
  pageNumberLine,
} from "../core/layout";
import { fonts, cssFont } from "../core/fonts";
function LineShape({ lines }: { lines: TextLine[] }) {
  return (
    <Shape
      listening={false}
      sceneFunc={(ctx) => {
        const c = ctx._context;
        c.textBaseline = "alphabetic";
        c.fontKerning = "none";
        for (const l of lines)
          for (const r of l.runs) {
            c.font = `${r.font.includes("italic") ? "italic " : ""}${r.font.includes("bold") ? "700 " : "400 "}${r.size}px "${cssFont(r.font)}"`;
            c.fillStyle = r.color;
            let x = l.x + r.x;
            for (const char of r.text) {
              c.fillText(char, x, l.y);
              x += fonts.measure(char, r.font, r.size);
            }
            if (r.underline) {
              c.fillRect(l.x + r.x, l.y + 1.5, r.width, 0.6);
            }
          }
      }}
    />
  );
}
function Artwork({ o, p }: { o: BookObject; p: Project }) {
  const [img, setImg] = useState<HTMLImageElement>();
  const asset = o.assetId ? p.assets[o.assetId] : undefined;
  useEffect(() => {
    if (!asset) return;
    const i = new Image();
    i.onload = () => setImg(i);
    i.src = `data:${asset.mime};base64,${asset.data}`;
    return () => {
      i.onload = null;
    };
  }, [asset?.data]);
  if (!img || !asset)
    return <Rect width={o.width} height={o.height} fill="#eeeeeb" />;
  return (
    <KImage
      image={img}
      width={o.width}
      height={o.height}
      crop={{
        x: o.crop.x * asset.width,
        y: o.crop.y * asset.height,
        width: o.crop.width * asset.width,
        height: o.crop.height * asset.height,
      }}
    />
  );
}
function PageBackground({ p, page }: { p: Project; page: LayoutPage }) {
  const background = getPageBackground(p, page).backgroundImage;
  const asset = background ? p.assets[background.assetId] : undefined;
  const [image, setImage] = useState<HTMLImageElement>();
  useEffect(() => {
    setImage(undefined);
    if (!asset) return;
    const img = new Image();
    img.onload = () => setImage(img);
    img.src = `data:${asset.mime};base64,${asset.data}`;
    return () => {
      img.onload = null;
    };
  }, [asset?.data]);
  if (!image || !asset || !background) return null;
  return (
    <KImage
      name="page-background"
      image={image}
      {...backgroundPlacement(asset, p.setup, background.fit)}
      listening={false}
    />
  );
}
export function PageCanvas({
  p,
  page,
  zoom,
  guides,
  selection,
  onSelect,
  onUpdate,
  onEdit,
  interactive = true,
}: {
  p: Project;
  page: LayoutPage;
  zoom: number;
  guides: boolean;
  selection: string[];
  onSelect: (ids: string[]) => void;
  onUpdate: (changes: { id: string; patch: Partial<BookObject> }[]) => void;
  onEdit: (id: string) => void;
  interactive?: boolean;
}) {
  const stage = useRef<Konva.Stage>(null),
    transformer = useRef<Konva.Transformer>(null);
  const [marquee, setMarquee] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const [resizing, setResizing] = useState<
    Record<string, { scaleX: number; scaleY: number }>
  >({});
  const objects = page.design?.objects ?? [];
  const selected = objects.filter(
    (o) => selection.includes(o.id) && !o.locked && !o.hidden,
  );
  const pad = guides ? 18 : 0;
  const s = p.setup;
  useEffect(() => {
    if (transformer.current && stage.current) {
      transformer.current.nodes(
        selected
          .map((o) => stage.current!.findOne(`#${o.id}`)!)
          .filter(Boolean),
      );
      transformer.current.getLayer()?.batchDraw();
    }
  }, [selection, page, zoom]);
  function select(o: BookObject, shift = false) {
    const ids = o.group
      ? objects.filter((x) => x.group === o.group).map((x) => x.id)
      : [o.id];
    onSelect(shift ? [...new Set([...selection, ...ids])] : ids);
  }
  return (
    <div className="page-canvas" aria-label={`Page ${page.number}`}>
      <Stage
        ref={stage}
        width={s.width * zoom + pad * 2}
        height={s.height * zoom + pad * 2}
        onMouseDown={(e) => {
          if (!interactive) return;
          if (e.target === e.target.getStage() || e.target.name() === "paper") {
            onSelect([]);
            const pos = e.target.getStage()!.getPointerPosition()!;
            start.current = {
              x: (pos.x - pad) / zoom,
              y: (pos.y - pad) / zoom,
            };
          }
        }}
        onMouseMove={(e) => {
          if (start.current) {
            const pos = e.target.getStage()!.getPointerPosition()!;
            const x = (pos.x - pad) / zoom,
              y = (pos.y - pad) / zoom;
            setMarquee({
              x: Math.min(x, start.current.x),
              y: Math.min(y, start.current.y),
              width: Math.abs(x - start.current.x),
              height: Math.abs(y - start.current.y),
            });
          }
        }}
        onMouseUp={() => {
          if (marquee && interactive) {
            onSelect(
              objects
                .filter(
                  (o) =>
                    !o.hidden &&
                    !o.locked &&
                    o.x < marquee.x + marquee.width &&
                    o.x + o.width > marquee.x &&
                    o.y < marquee.y + marquee.height &&
                    o.y + o.height > marquee.y,
                )
                .map((o) => o.id),
            );
          }
          start.current = null;
          setMarquee(null);
        }}
      >
        <Layer x={pad} y={pad} scaleX={zoom} scaleY={zoom}>
          <Rect
            name="paper"
            width={s.width}
            height={s.height}
            fill={getPageBackground(p, page).background}
            shadowColor="#294236"
            shadowBlur={12 / zoom}
            shadowOpacity={0.1}
            shadowOffsetY={3 / zoom}
          />
          <Group clipX={0} clipY={0} clipWidth={s.width} clipHeight={s.height}>
            <PageBackground p={p} page={page} />
            <LineShape lines={page.lines} />
            {objects
              .filter((o) => !o.hidden)
              .map((o) => (
                <Group
                  key={o.id}
                  id={o.id}
                  x={o.x}
                  y={o.y}
                  width={o.width}
                  height={o.height}
                  rotation={o.rotation}
                  opacity={o.opacity}
                  draggable={interactive && !o.locked}
                  listening={interactive}
                  onClick={(e) => {
                    e.cancelBubble = true;
                    select(o, e.evt.shiftKey);
                  }}
                  onTap={() => select(o)}
                  onDblClick={() => {
                    if (o.type === "text" && !o.locked) onEdit(o.id);
                  }}
                  onDragStart={() => {
                    if (!selection.includes(o.id)) select(o);
                  }}
                  onDragEnd={(e) => {
                    const node = e.target;
                    const dx = node.x() - o.x,
                      dy = node.y() - o.y;
                    let x = node.x(),
                      y = node.y();
                    if (!e.evt.altKey) {
                      for (const snap of [
                        0,
                        s.width / 2 - o.width / 2,
                        s.width - o.width,
                        s.inside + s.gutter,
                      ])
                        if (Math.abs(x - snap) < 5 / zoom) x = snap;
                      for (const snap of [
                        0,
                        s.height / 2 - o.height / 2,
                        s.height - o.height,
                        s.top,
                      ])
                        if (Math.abs(y - snap) < 5 / zoom) y = snap;
                    }
                    const moving = selection.includes(o.id) ? selected : [o];
                    onUpdate(
                      moving.map((item) => ({
                        id: item.id,
                        patch: {
                          x: item.id === o.id ? x : item.x + dx,
                          y: item.id === o.id ? y : item.y + dy,
                        },
                      })),
                    );
                  }}
                >
                  {o.type === "rect" && (
                    <Rect
                      width={o.width}
                      height={o.height}
                      fill={o.fill}
                      stroke={o.stroke}
                      strokeWidth={o.strokeWidth}
                    />
                  )}
                  {o.type === "ellipse" && (
                    <Ellipse
                      x={o.width / 2}
                      y={o.height / 2}
                      radiusX={o.width / 2}
                      radiusY={o.height / 2}
                      fill={o.fill}
                      stroke={o.stroke}
                      strokeWidth={o.strokeWidth}
                    />
                  )}
                  {o.type === "line" && (
                    <Line
                      points={[0, 0, o.width, o.height]}
                      stroke={o.stroke}
                      strokeWidth={o.strokeWidth || 1}
                      hitStrokeWidth={12 / zoom}
                    />
                  )}
                  {o.type === "image" && <Artwork o={o} p={p} />}
                  {o.type === "text" &&
                    (() => {
                      const scale = resizing[o.id] ?? { scaleX: 1, scaleY: 1 };
                      const frame = {
                        ...o,
                        width: Math.max(4, o.width * scale.scaleX),
                        height: Math.max(4, o.height * scale.scaleY),
                      };
                      const lines = textBoxLines(frame);
                      return (
                        <Group
                          name="text-content"
                          scaleX={1 / scale.scaleX}
                          scaleY={1 / scale.scaleY}
                        >
                          <Rect
                            width={frame.width}
                            height={frame.height}
                            fill="rgba(255,255,255,0)"
                          />
                          <Group
                            clipX={0}
                            clipY={0}
                            clipWidth={frame.width}
                            clipHeight={frame.height}
                          >
                            <LineShape lines={lines} />
                          </Group>
                          {interactive &&
                            lines.length * o.fontSize * o.lineHeight >
                              frame.height && (
                              <Rect
                                x={frame.width - 10 / zoom}
                                y={frame.height - 10 / zoom}
                                width={10 / zoom}
                                height={10 / zoom}
                                fill="#bd6149"
                              />
                            )}
                        </Group>
                      );
                    })()}
                </Group>
              ))}
            {s.numbering && (
              <LineShape lines={[pageNumberLine(p, page.number)]} />
            )}
          </Group>
          {guides && (
            <>
              <Rect
                width={s.width}
                height={s.height}
                stroke="#6b91a5"
                strokeWidth={0.7 / zoom}
                listening={false}
              />
              <Rect
                x={isLeftPage(p, page.number) ? s.outside : s.inside + s.gutter}
                y={s.top}
                width={s.width - s.inside - s.outside - s.gutter}
                height={s.height - s.top - s.bottom}
                stroke="#4f8c78"
                strokeWidth={0.7 / zoom}
                dash={[3 / zoom, 3 / zoom]}
                listening={false}
              />
              {s.bleed > 0 && (
                <Rect
                  x={-s.bleed}
                  y={-s.bleed}
                  width={s.width + 2 * s.bleed}
                  height={s.height + 2 * s.bleed}
                  stroke="#c4716c"
                  dash={[6 / zoom, 3 / zoom]}
                  strokeWidth={0.7 / zoom}
                  listening={false}
                />
              )}
            </>
          )}
          {marquee && (
            <Rect
              {...marquee}
              fill="rgba(38,92,81,0.1)"
              stroke="#265c51"
              strokeWidth={1 / zoom}
            />
          )}
          {interactive && (
            <Transformer
              ref={transformer}
              onTransform={() => {
                const preview: typeof resizing = {};
                for (const item of selected) {
                  const node = stage.current?.findOne(`#${item.id}`);
                  if (node && item.type === "text")
                    preview[item.id] = {
                      scaleX: node.scaleX(),
                      scaleY: node.scaleY(),
                    };
                }
                setResizing(preview);
              }}
              onTransformEnd={() => {
                if (!stage.current) return;
                const changes = selected.map((item) => {
                  const node = stage.current!.findOne(`#${item.id}`)!;
                  const patch = {
                    x: node.x(),
                    y: node.y(),
                    width: Math.max(4, item.width * node.scaleX()),
                    height: Math.max(4, item.height * node.scaleY()),
                    rotation: node.rotation(),
                  };
                  node.scale({ x: 1, y: 1 });
                  return { id: item.id, patch };
                });
                setResizing({});
                onUpdate(changes);
              }}
              flipEnabled={false}
              keepRatio={selected.some(
                (o) => o.type === "image" && o.keepRatio,
              )}
              rotateEnabled
              borderStroke="#337568"
              anchorStroke="#337568"
              anchorFill="#ffffff"
              anchorSize={7}
              borderStrokeWidth={1}
              boundBoxFunc={(oldBox, newBox) =>
                Math.abs(newBox.width) < 4 || Math.abs(newBox.height) < 4
                  ? oldBox
                  : newBox
              }
            />
          )}
        </Layer>
      </Stage>
    </div>
  );
}
