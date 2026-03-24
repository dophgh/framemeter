export type FilmMeta = {
  title: string;
  dir: string;
  dp: string;
  loc: string;
  dn: string;
  size: string;
  type: string;
  level: string;
  move: string;
  color: string;
  lens: string;
  camera: string;
  lenses: string;
};

export type Marker = {
  n: number;
  x: number;
  y: number;
  text: string;
  /** 마커 원 배경색 */
  color: string;
};

export type StrokePoint = { x: number; y: number };

export type DrawStroke = {
  color: string;
  width: number;
  points: StrokePoint[];
};

export type TextAnnotation = {
  id: string;
  x: number;
  y: number;
  color: string;
  content: string;
};

export type CinemaPage = {
  id: number;
  imageURL: string | null;
  imgEl: HTMLImageElement | null;
  px: ImageData | null;
  W: number;
  H: number;
  meta: FilmMeta;
  markers: Marker[];
  strokes: DrawStroke[];
  textNotes: TextAnnotation[];
  /** NOTE 드로잉 캔버스 논리 픽셀 크기(PDF 스케일용) */
  drawOverlaySize: { w: number; h: number } | null;
  thumb: string | null;
};

export type TabId = "data" | "note" | "meta";

export type NoteTool = "marker" | "draw" | "text";
