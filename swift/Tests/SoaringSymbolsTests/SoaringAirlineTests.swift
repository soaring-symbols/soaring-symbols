import XCTest

@testable import SoaringSymbols

final class SoaringAirlineTests: XCTestCase {
    func testLookup() {
        XCTAssertGreaterThan(SoaringAirline.all.count, 100)

        let vna = SoaringAirline.find("VN")
        XCTAssertEqual(vna?.name, "Vietnam Airlines")
        XCTAssertEqual(SoaringAirline.find("hvn")?.slug, "vietnam-airlines")
        XCTAssertEqual(SoaringAirline.find("Vietnam Airlines")?.iata, "VN")
        XCTAssertEqual(SoaringAirline.find("vietnam-airlines")?.icao, "HVN")
        XCTAssertEqual(SoaringAirline.find("Aerolineas Argentinas")?.iata, "AR")
        XCTAssertEqual(SoaringAirline.find("Jet2.com")?.slug, "jet2com")
        XCTAssertEqual(SoaringAirline.find("T'way Air")?.slug, "tway-air")
        XCTAssertNil(SoaringAirline.find("NOPE"))
        XCTAssertNil(SoaringAirline.find("  "))
        XCTAssertEqual(SoaringAirline.vietnamAirlines.iata, "VN")
        XCTAssertEqual(SoaringAirline.find("QF")?.assets.icon?.hasColor, false)
        XCTAssertEqual(
            SoaringAirline.find("QF")?.preparedLogo(kind: .icon, monochrome: false)?.template,
            true
        )
    }

    func testNamesMatchSlugs() {
        for airline in SoaringAirline.all {
            XCTAssertEqual(AirlineSlug.make(airline.name), airline.slug, airline.name)
        }
    }

    func testVietnamAirlinesAssets() throws {
        let vna = try XCTUnwrap(SoaringAirline.find("VN"))
        let logo = try XCTUnwrap(vna.pngData(for: .logo))
        XCTAssertEqual(
            [UInt8](logo.prefix(8)),
            [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]
        )
        XCTAssertEqual(pngInt(logo, at: 16), AirlineCatalogData.pngPixelSize)
        XCTAssertEqual(pngInt(logo, at: 20), AirlineCatalogData.pngPixelSize)
        XCTAssertEqual(logo[25], 6)

        let svg = try XCTUnwrap(vna.svg(for: .logo))
        XCTAssertTrue(svg.contains("<svg"))
        XCTAssertTrue(svg.contains("Vietnam Airlines"))
        XCTAssertNotNil(vna.pngData(for: .logo, monochrome: true))
        XCTAssertNil(vna.pngData(for: .icon, monochrome: true))
        XCTAssertNil(vna.pngData(for: .tail))
        XCTAssertEqual(vna.preparedLogo(kind: .logo, monochrome: true)?.template, true)
        XCTAssertEqual(vna.preparedLogo(kind: .icon, monochrome: true)?.template, false)

        let missingIcon = SoaringAirline.all.first {
            $0.assets.icon == nil && $0.assets.logo != nil
        }
        XCTAssertEqual(
            missingIcon?.preparedLogo(kind: .icon, monochrome: false)?.kind,
            .logo
        )
    }

    func testEveryDeclaredAssetLoads() {
        for airline in SoaringAirline.all {
            for kind in SoaringAirline.AssetKind.allCases {
                guard let asset = airline.assets.asset(for: kind) else { continue }
                if asset.hasColor {
                    XCTAssertNotNil(
                        airline.pngData(for: kind),
                        "\(airline.slug) \(kind.rawValue) png"
                    )
                    XCTAssertNotNil(
                        airline.svg(for: kind),
                        "\(airline.slug) \(kind.rawValue) svg"
                    )
                } else {
                    XCTAssertNil(airline.pngData(for: kind))
                    XCTAssertNil(airline.svg(for: kind))
                }
                if asset.hasMonochrome {
                    XCTAssertNotNil(
                        airline.pngData(for: kind, monochrome: true),
                        "\(airline.slug) \(kind.rawValue) mono"
                    )
                } else {
                    XCTAssertNil(airline.pngData(for: kind, monochrome: true))
                }
            }
        }
    }
}

private func pngInt(_ data: Data, at offset: Int) -> Int {
    let bytes = [UInt8](data[offset ..< offset + 4])

    return Int(bytes[0]) << 24 | Int(bytes[1]) << 16 | Int(bytes[2]) << 8 | Int(bytes[3])
}
