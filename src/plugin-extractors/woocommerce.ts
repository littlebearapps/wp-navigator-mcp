/**
 * WooCommerce Settings Extractor
 *
 * Extracts core WooCommerce settings from wp_options.
 *
 * @package WP_Navigator_Pro
 * @since 2.1.0
 */

import type { PluginSettingsExtractor } from './types.js';

/**
 * Core WooCommerce options to extract (most commonly needed)
 */
const CORE_OPTIONS = [
  'woocommerce_currency',
  'woocommerce_currency_pos',
  'woocommerce_price_thousand_sep',
  'woocommerce_price_decimal_sep',
  'woocommerce_price_num_decimals',
  'woocommerce_default_country',
  'woocommerce_allowed_countries',
  'woocommerce_specific_allowed_countries',
  'woocommerce_ship_to_countries',
  'woocommerce_calc_taxes',
  'woocommerce_prices_include_tax',
  'woocommerce_tax_based_on',
  'woocommerce_shipping_tax_class',
  'woocommerce_tax_round_at_subtotal',
  'woocommerce_tax_display_shop',
  'woocommerce_tax_display_cart',
  'woocommerce_enable_coupons',
  'woocommerce_calc_discounts_sequentially',
  'woocommerce_cart_redirect_after_add',
  'woocommerce_enable_ajax_add_to_cart',
  'woocommerce_placeholder_image',
  'woocommerce_weight_unit',
  'woocommerce_dimension_unit',
  'woocommerce_enable_reviews',
  'woocommerce_review_rating_verification_required',
  'woocommerce_review_rating_required',
  'woocommerce_enable_review_rating',
  'woocommerce_stock_format',
  'woocommerce_manage_stock',
  'woocommerce_hold_stock_minutes',
  'woocommerce_notify_low_stock',
  'woocommerce_notify_no_stock',
  'woocommerce_low_stock_amount',
  'woocommerce_out_of_stock_visibility',
];

export const woocommerceExtractor: PluginSettingsExtractor = {
  slug: 'woocommerce',
  displayName: 'WooCommerce',
  optionPrefixes: ['woocommerce_'],

  shouldInclude(optionName: string): boolean {
    return CORE_OPTIONS.includes(optionName);
  },

  extract(options: Record<string, unknown>): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(options)) {
      // Only include core options
      if (CORE_OPTIONS.includes(key)) {
        result[key] = value;
      }
    }

    return result;
  },
};
