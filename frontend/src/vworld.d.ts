/**
 * VWorld WebGL 3D 지도 SDK(webglMapInit.js.do, version 3.0) 전역 타입.
 * 이 SDK는 npm 패키지가 아니라 <script> 태그로 런타임에 로드되는 외부 전역이라(공식 예제:
 * https://github.com/V-world/V-world_API_sample) @types 패키지가 없다. 정확한 Cesium 타입을
 * 전부 옮기는 대신, components/VWorldMap.tsx 한 파일에서만 쓰는 최소 표면만 선언한다.
 */

declare global {
  interface Window {
    vw?: typeof vw
    Cesium?: typeof Cesium
    ws3d?: { viewer: Cesium.Viewer }
  }

  namespace vw {
    class CoordZ {
      constructor(lng: number, lat: number, height: number)
    }
    class Direction {
      constructor(heading: number, pitch: number, roll: number)
    }
    class CameraPosition {
      constructor(coord: CoordZ, direction: Direction)
    }
    class Map {
      setOption(options: {
        mapId: string
        initPosition: CameraPosition
        logo?: boolean
        navigation?: boolean
      }): void
      setMapId(id: string): void
      start(): void
      destroy?(): void
    }
    let ws3dInitCallBack: (() => void) | undefined
  }

  namespace Cesium {
    class Cartesian3 {
      static fromDegrees(lng: number, lat: number, height?: number): Cartesian3
    }
    class HeadingPitchRoll {
      constructor(heading: number, pitch: number, roll: number)
    }
    class HeadingPitchRange {
      constructor(heading: number, pitch: number, range: number)
    }
    class BoundingSphere {
      constructor(center: Cartesian3, radius: number)
    }
    class Transforms {
      static headingPitchRollQuaternion(position: Cartesian3, hpr: HeadingPitchRoll): unknown
    }
    class Math {
      static toRadians(degrees: number): number
    }
    class Color {
      static fromCssColorString(css: string): Color
      withAlpha(alpha: number): Color
      static WHITE: Color
      static BLACK: Color
    }
    class ScreenSpaceEventHandler {
      constructor(canvas: unknown)
      setInputAction(action: (movement: { position: unknown }) => void, type: number): void
    }
    const ScreenSpaceEventType: { LEFT_CLICK: number }
    const HeightReference: { CLAMP_TO_GROUND: number; NONE: number }
    const VerticalOrigin: { BOTTOM: number; CENTER: number }
    class Entity {
      id: string
      position?: unknown
      [key: string]: unknown
    }
    class EntityCollection {
      add(options: Record<string, unknown>): Entity
      remove(entity: Entity): boolean
      removeAll(): void
    }
    class DataSourceCollection {
      add(dataSource: unknown): void
      remove(dataSource: unknown, destroy?: boolean): void
    }
    class GeoJsonDataSource {
      static load(
        data: object | string,
        options?: { stroke?: Color; fill?: Color; strokeWidth?: number; clampToGround?: boolean },
      ): Promise<GeoJsonDataSource>
      entities: EntityCollection
    }
    class Scene {
      pick(windowPosition: unknown): { id?: Entity } | undefined
      sampleHeightMostDetailed?(positions: Cartesian3[]): Promise<Cartesian3[]>
      globe: { ellipsoid: unknown }
    }
    class Camera {
      flyTo(options: { destination: Cartesian3; orientation?: { heading: number; pitch: number; roll?: number } }): void
      setView(options: { destination: Cartesian3; orientation?: { heading: number; pitch: number; roll?: number } }): void
      viewBoundingSphere(boundingSphere: BoundingSphere, offset: HeadingPitchRange): void
    }
    class Viewer {
      entities: EntityCollection
      dataSources: DataSourceCollection
      scene: Scene
      camera: Camera
      screenSpaceEventHandler: ScreenSpaceEventHandler
      canvas: HTMLCanvasElement
      trackedEntity?: Entity
      destroy(): void
    }
  }
}

export {}
