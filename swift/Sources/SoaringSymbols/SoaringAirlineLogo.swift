#if canImport(UIKit)
import UIKit
#elseif canImport(AppKit)
import AppKit
#endif

#if canImport(SwiftUI)
import SwiftUI
#endif

#if canImport(UIKit)
extension SoaringAirline {
    /// Color artwork keeps brand colors. A monochrome asset is a template image and picks up a tint.
    public func uiImage(
        for kind: AssetKind = .logo,
        monochrome: Bool = false
    ) -> UIImage? {
        guard let prepared = preparedLogo(kind: kind, monochrome: monochrome) else {
            return nil
        }

        return AirlineBitmap.uiImage(prepared, slug: slug)
    }
}

private enum AirlineBitmap {
    private static let cache: NSCache<NSString, UIImage> = {
        let cache = NSCache<NSString, UIImage>()
        cache.countLimit = 200

        return cache
    }()

    static func uiImage(_ prepared: PreparedLogo, slug: String) -> UIImage? {
        let key = "\(slug)|\(prepared.kind.rawValue)|\(prepared.template)" as NSString
        if let cached = cache.object(forKey: key) { return cached }

        let points: CGFloat = prepared.kind == .logo ? 64 : 24
        let scale = CGFloat(AirlineCatalogData.pngPixelSize) / points
        guard var image = UIImage(data: prepared.data, scale: scale) else {
            return nil
        }
        image = prepared.template
            ? image.withRenderingMode(.alwaysTemplate)
            : image.withRenderingMode(.alwaysOriginal)
        cache.setObject(image, forKey: key)

        return image
    }
}
#elseif canImport(AppKit)
extension SoaringAirline {
    public func nsImage(
        for kind: AssetKind = .logo,
        monochrome: Bool = false
    ) -> NSImage? {
        guard let prepared = preparedLogo(kind: kind, monochrome: monochrome) else {
            return nil
        }

        return AirlineBitmap.nsImage(prepared, slug: slug)
    }
}

private enum AirlineBitmap {
    private static let cache: NSCache<NSString, NSImage> = {
        let cache = NSCache<NSString, NSImage>()
        cache.countLimit = 200

        return cache
    }()

    static func nsImage(_ prepared: PreparedLogo, slug: String) -> NSImage? {
        let key = "\(slug)|\(prepared.kind.rawValue)|\(prepared.template)" as NSString
        if let cached = cache.object(forKey: key) { return cached }
        guard let image = NSImage(data: prepared.data) else { return nil }

        let points: CGFloat = prepared.kind == .logo ? 64 : 24
        image.size = NSSize(width: points, height: points)
        image.isTemplate = prepared.template
        cache.setObject(image, forKey: key)

        return image
    }
}
#endif

#if canImport(SwiftUI)
extension SoaringAirline {
    public struct Logo: View {
        private let key: String
        private let monochrome: Bool
        private let size: CGFloat?

        public init(_ key: String, monochrome: Bool = false, size: CGFloat? = nil) {
            self.key = key
            self.monochrome = monochrome
            self.size = size
        }

        public init(
            _ airline: SoaringAirline,
            monochrome: Bool = false,
            size: CGFloat? = nil
        ) {
            self.init(airline.slug, monochrome: monochrome, size: size)
        }

        public var body: some View {
            AirlineMark(key: key, kind: .logo, monochrome: monochrome)
                .soaringSized(size)
        }
    }

    public struct Icon: View {
        private let key: String
        private let monochrome: Bool
        private let size: CGFloat?

        public init(_ key: String, monochrome: Bool = false, size: CGFloat? = nil) {
            self.key = key
            self.monochrome = monochrome
            self.size = size
        }

        public init(
            _ airline: SoaringAirline,
            monochrome: Bool = false,
            size: CGFloat? = nil
        ) {
            self.init(airline.slug, monochrome: monochrome, size: size)
        }

        public var body: some View {
            AirlineMark(key: key, kind: .icon, monochrome: monochrome)
                .soaringSized(size)
        }
    }

    public struct Tail: View {
        private let key: String
        private let monochrome: Bool
        private let size: CGFloat?

        public init(_ key: String, monochrome: Bool = false, size: CGFloat? = nil) {
            self.key = key
            self.monochrome = monochrome
            self.size = size
        }

        public init(
            _ airline: SoaringAirline,
            monochrome: Bool = false,
            size: CGFloat? = nil
        ) {
            self.init(airline.slug, monochrome: monochrome, size: size)
        }

        public var body: some View {
            AirlineMark(key: key, kind: .tail, monochrome: monochrome)
                .soaringSized(size)
        }
    }
}

extension View {
    @ViewBuilder
    fileprivate func soaringSized(_ size: CGFloat?) -> some View {
        if let size {
            frame(width: size, height: size)
        } else {
            self
        }
    }
}

struct AirlineMark: View {
    let key: String
    let kind: SoaringAirline.AssetKind
    let monochrome: Bool

    var body: some View {
        let airline = SoaringAirline.find(key)
        content(for: airline)
            .aspectRatio(1, contentMode: .fit)
            .accessibilityLabel(airline?.name ?? "Airline")
            .accessibilityAddTraits(.isImage)
    }

    @ViewBuilder
    private func content(for airline: SoaringAirline?) -> some View {
        if let airline, let prepared = airline.preparedLogo(kind: kind, monochrome: monochrome),
            let image = platformImage(prepared, slug: airline.slug)
        {
            image
                .renderingMode(prepared.template ? .template : .original)
                .resizable()
                .scaledToFit()
        } else {
            placeholder(airline)
        }
    }

    private func placeholder(_ airline: SoaringAirline?) -> some View {
        ZStack {
            RoundedRectangle(cornerRadius: 4)
                .fill(Color.secondary.opacity(0.15))
            Text(airline?.iata ?? "")
                .font(.caption.weight(.semibold))
                .minimumScaleFactor(0.5)
                .foregroundStyle(.secondary)
        }
    }

    #if canImport(UIKit)
    private func platformImage(_ prepared: PreparedLogo, slug: String) -> Image? {
        guard let image = AirlineBitmap.uiImage(prepared, slug: slug) else { return nil }

        return Image(uiImage: image)
    }
    #elseif canImport(AppKit)
    private func platformImage(_ prepared: PreparedLogo, slug: String) -> Image? {
        guard let image = AirlineBitmap.nsImage(prepared, slug: slug) else { return nil }

        return Image(nsImage: image)
    }
    #else
    private func platformImage(_ prepared: PreparedLogo, slug: String) -> Image? {
        nil
    }
    #endif
}
#endif
