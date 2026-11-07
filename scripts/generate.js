// Tidy airlines.json and check it before it is committed: sort it, order each
// entry's keys, drop the fields only the build adds, delete committed
// -mono.svg files the build derives, and validate the catalog as it would be
// published.
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { removeDerivedMonos, toSlug } from '../utils/index.js'
import { normalizeCatalog, publishCatalog } from '../utils/catalog.js'
import { validateAirlines } from '../utils/schema.js'

const airlines = normalizeCatalog(
    JSON.parse(readFileSync('airlines.json', 'utf8')),
)

const removedMonos = []

for (const airline of airlines) {
    const slug = toSlug(airline.name)
    // An airline with `marks` has no SVGs of its own: the build copies the
    // files of the airline it names to its slug
    if (airline.marks && existsSync(`assets/${slug}`)) {
        console.error(
            `❌ ${airline.name} has both marks "${airline.marks}" and its own assets/${slug}; keep one`,
        )
        process.exit(1)
    }
    if (!airline.marks) removedMonos.push(...removeDerivedMonos(slug))
}

// Check the catalog the build would publish, generated fields included,
// before writing anything
const problems = validateAirlines(publishCatalog(airlines), {
    published: true,
})
if (problems.length) {
    console.error('❌ airlines.json does not match airlines.schema.json:')
    problems.forEach((problem) => console.error(`  - ${problem}`))
    process.exit(1)
}

writeFileSync('airlines.json', JSON.stringify(airlines, null, 4))

if (removedMonos.length) {
    console.log(
        `✅ Removed ${removedMonos.length} -mono.svg file(s) the build derives from single-color assets`,
    )
}
console.log('✅ airlines.json is sorted and valid')
