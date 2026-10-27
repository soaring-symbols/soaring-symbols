// swift-tools-version: 5.9

import PackageDescription

let package = Package(
    name: "SoaringSymbols",
    platforms: [
        .iOS(.v15),
        .macOS(.v12),
        .tvOS(.v15),
        .watchOS(.v8),
    ],
    products: [
        .library(name: "SoaringSymbols", targets: ["SoaringSymbols"]),
    ],
    targets: [
        .target(
            name: "SoaringSymbols",
            path: "swift/Sources/SoaringSymbols",
            resources: [
                .copy("Resources/png"),
                .copy("Resources/svg"),
            ]
        ),
        .testTarget(
            name: "SoaringSymbolsTests",
            dependencies: ["SoaringSymbols"],
            path: "swift/Tests/SoaringSymbolsTests"
        ),
    ]
)
