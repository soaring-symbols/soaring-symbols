import Foundation

/// Airline catalog entry. Prefixed so it does not collide with an `Airline` type from another module.
public struct SoaringAirline: Identifiable, Sendable, Hashable {
    public enum AssetKind: String, CaseIterable, Sendable, Hashable {
        case icon
        case logo
        case tail
    }

    public enum ColorModel: String, Sendable, Hashable {
        case single
        case multi
    }

    public struct Asset: Sendable, Hashable {
        public let kind: AssetKind
        public let colorModel: ColorModel?
        public let colors: [String]
        public let hasColor: Bool
        public let hasMonochrome: Bool
    }

    public struct Assets: Sendable, Hashable {
        public let icon: Asset?
        public let logo: Asset?
        public let tail: Asset?

        public func asset(for kind: AssetKind) -> Asset? {
            switch kind {
            case .icon:
                return icon
            case .logo:
                return logo
            case .tail:
                return tail
            }
        }
    }

    public struct Branding: Sendable, Hashable {
        public let primaryColor: String?
        public let tagline: String?
        public let guidelines: String?
        public let colors: [AssetKind: [String]]

        public var guidelinesURL: URL? {
            guidelines.flatMap { URL(string: $0) }
        }
    }

    public struct Subsidiary: Identifiable, Sendable, Hashable {
        public let name: String
        public let iata: String
        public let icao: String
        public let country: String
        public let slug: String
        public let flagCarrier: Bool

        public var id: String { slug }
    }

    public let name: String
    public let iata: String
    public let icao: String
    public let country: String
    public let flagCarrier: Bool
    public let defunct: Bool
    public let website: String?
    public let alliance: String?
    public let slug: String
    public let branding: Branding
    public let assets: Assets
    public let subsidiaries: [Subsidiary]

    public var id: String { slug }

    public var websiteURL: URL? {
        website.flatMap { URL(string: $0) }
    }

    public static var all: [SoaringAirline] { AirlineCatalogData.airlines }

    /// Looks up an airline by IATA, ICAO, name, or slug.
    public static func find(_ key: String) -> SoaringAirline? {
        let trimmed = key.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return nil }

        let upper = trimmed.uppercased()
        if let match = AirlineIndex.byIATA[upper] { return match }
        if let match = AirlineIndex.byICAO[upper] { return match }

        let lower = trimmed.lowercased()
        if let match = AirlineIndex.byName[lower] { return match }
        if let match = AirlineIndex.bySlug[lower] { return match }

        let slug = AirlineSlug.make(trimmed)
        if slug != lower, let match = AirlineIndex.bySlug[slug] {
            return match
        }

        return nil
    }

    public func pngData(for kind: AssetKind, monochrome: Bool = false) -> Data? {
        guard let asset = assets.asset(for: kind) else { return nil }
        if monochrome {
            guard asset.hasMonochrome else { return nil }
        } else {
            guard asset.hasColor else { return nil }
        }

        return AirlineFiles.load(
            slug: slug,
            kind: kind,
            monochrome: monochrome,
            ext: "png"
        )
    }

    public func svg(for kind: AssetKind, monochrome: Bool = false) -> String? {
        guard let asset = assets.asset(for: kind) else { return nil }
        if monochrome {
            guard asset.hasMonochrome else { return nil }
        } else {
            guard asset.hasColor else { return nil }
        }
        guard
            let data = AirlineFiles.load(
                slug: slug,
                kind: kind,
                monochrome: monochrome,
                ext: "svg"
            )
        else { return nil }

        return String(data: data, encoding: .utf8)
    }

    func preparedLogo(kind: AssetKind, monochrome: Bool) -> PreparedLogo? {
        let resolved: AssetKind
        if assets.asset(for: kind) != nil {
            resolved = kind
        } else if kind == .icon, assets.logo != nil {
            resolved = .logo
        } else {
            return nil
        }

        guard let asset = assets.asset(for: resolved) else { return nil }

        if monochrome, asset.hasMonochrome,
            let data = pngData(for: resolved, monochrome: true)
        {
            return PreparedLogo(data: data, template: true, kind: resolved)
        }

        if let data = pngData(for: resolved, monochrome: false) {
            return PreparedLogo(data: data, template: false, kind: resolved)
        }

        if let data = pngData(for: resolved, monochrome: true) {
            return PreparedLogo(data: data, template: true, kind: resolved)
        }

        return nil
    }
}

struct PreparedLogo {
    let data: Data
    let template: Bool
    let kind: SoaringAirline.AssetKind
}

enum AirlineFiles {
    static func load(
        slug: String,
        kind: SoaringAirline.AssetKind,
        monochrome: Bool,
        ext: String
    ) -> Data? {
        let base = monochrome ? "\(kind.rawValue)-mono" : kind.rawValue
        guard
            let url = Bundle.module.url(
                forResource: base,
                withExtension: ext,
                subdirectory: "\(ext)/\(slug)"
            )
        else { return nil }

        return try? Data(contentsOf: url)
    }
}

enum AirlineSlug {
    /// Mirrors `slugify(name, { lower: true, strict: true })`.
    static func make(_ value: String) -> String {
        let folded = value.folding(
            options: [.diacriticInsensitive, .caseInsensitive],
            locale: Locale(identifier: "en_US_POSIX")
        )
        let lowered = folded.lowercased()
        var kept = ""
        for scalar in lowered.unicodeScalars {
            if CharacterSet.alphanumerics.contains(scalar)
                || CharacterSet.whitespacesAndNewlines.contains(scalar)
            {
                kept.unicodeScalars.append(scalar)
            }
        }
        let parts = kept.split { $0.isWhitespace }.map(String.init)

        return parts.joined(separator: "-")
    }
}

enum AirlineIndex {
    static let byIATA: [String: SoaringAirline] = {
        var index: [String: SoaringAirline] = [:]
        for airline in SoaringAirline.all where !airline.iata.isEmpty {
            index[airline.iata.uppercased()] = airline
        }

        return index
    }()

    static let byICAO: [String: SoaringAirline] = {
        var index: [String: SoaringAirline] = [:]
        for airline in SoaringAirline.all where !airline.icao.isEmpty {
            index[airline.icao.uppercased()] = airline
        }

        return index
    }()

    static let byName: [String: SoaringAirline] = {
        var index: [String: SoaringAirline] = [:]
        for airline in SoaringAirline.all {
            index[airline.name.lowercased()] = airline
        }

        return index
    }()

    static let bySlug: [String: SoaringAirline] = {
        var index: [String: SoaringAirline] = [:]
        for airline in SoaringAirline.all {
            index[airline.slug] = airline
        }

        return index
    }()

    static func airline(slug: String) -> SoaringAirline {
        guard let airline = bySlug[slug] else {
            fatalError("Missing generated airline \(slug)")
        }

        return airline
    }
}
