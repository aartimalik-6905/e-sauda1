import {
  Smartphone,
  Bike,
  Armchair,
  Snowflake,
  Keyboard,
  ShoppingBag,
  BookOpen,
  Dumbbell,
  Package,
  LucideIcon,
} from 'lucide-react'
import { Category } from '../types'

// One clean line-icon per category, shared by every screen that shows a
// category picker (Home's grid, Sell's wizard) so a redesign here updates
// both at once instead of drifting apart.
export const categoryIcons: Record<Category, LucideIcon> = {
  Mobiles: Smartphone,
  Vehicles: Bike,
  Furniture: Armchair,
  Appliances: Snowflake,
  Electronics: Keyboard,
  Fashion: ShoppingBag,
  Books: BookOpen,
  Sports: Dumbbell,
  Others: Package,
}

export function categoryIcon(category: Category | string): LucideIcon {
  return categoryIcons[category as Category] || Package
}
