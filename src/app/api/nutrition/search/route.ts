import { NextRequest, NextResponse } from 'next/server'

interface OpenFoodFactsProduct {
  product_name?: string
  brands?: string
  nutriments?: {
    'energy-kcal_100g'?: number
    proteins_100g?: number
    carbohydrates_100g?: number
    fat_100g?: number
  }
  image_small_url?: string
}

interface OpenFoodFactsResponse {
  products?: OpenFoodFactsProduct[]
}

interface SimplifiedProduct {
  name: string
  brand: string
  calories: number | null
  protein_g: number | null
  carbs_g: number | null
  fat_g: number | null
  image: string | null
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const q = searchParams.get('q')

    if (!q || q.trim().length === 0) {
      return NextResponse.json({ results: [], error: 'Zoekterm vereist' }, { status: 400 })
    }

    const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(q)}&search_simple=1&action=process&json=1&page_size=15&fields=product_name,nutriments,image_small_url,brands`

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Performance-Platform-Nutrition-Search (+https://github.com)',
      },
    })

    if (!response.ok) {
      return NextResponse.json(
        { results: [], error: 'Fout bij zoeken in voedingsdatabase' },
        { status: response.status }
      )
    }

    const data: OpenFoodFactsResponse = await response.json()
    const products = data.products || []

    const simplified: SimplifiedProduct[] = products
      .filter(product => product.product_name && product.product_name.trim().length > 0)
      .map(product => ({
        name: product.product_name || 'Onbekend product',
        brand: product.brands || 'Onbekend merk',
        calories: product.nutriments?.['energy-kcal_100g'] ?? null,
        protein_g: product.nutriments?.proteins_100g ?? null,
        carbs_g: product.nutriments?.carbohydrates_100g ?? null,
        fat_g: product.nutriments?.fat_100g ?? null,
        image: product.image_small_url ?? null,
      }))

    return NextResponse.json({ results: simplified, error: null })
  } catch (error) {
    console.error('Food search error:', error)
    return NextResponse.json(
      { results: [], error: 'Serverfout bij zoeken' },
      { status: 500 }
    )
  }
}
