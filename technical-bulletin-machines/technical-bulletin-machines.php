<?php
/**
 * Plugin Name: Technical Bulletin Machines
 * Plugin URI:  https://amtec.uplb.edu.ph
 * Description: Browse and compare agricultural machine specifications by category. Uses Google Sheets as a live data source.
 * Version:     1.0.1
 * Author:      AMTEC - UPLB
 * Text Domain: technical-bulletin-machines
 */

if ( ! defined( 'ABSPATH' ) ) exit;

// ─── 1. Register & Enqueue Assets ─────────────────────────────────────────────

function tbm_register_assets() {
	wp_register_style(
		'tbm-css',
		plugin_dir_url( __FILE__ ) . 'assets/styles.css',
		[],
		'1.0.1'
	);

	wp_register_script(
		'tbm-js',
		plugin_dir_url( __FILE__ ) . 'assets/app.js',
		[],
		'1.0.1',
		true
	);

	wp_localize_script( 'tbm-js', 'TBM_PLUGIN', [
		'pluginUrl' => plugin_dir_url( __FILE__ ),
	] );
}
add_action( 'wp_enqueue_scripts', 'tbm_register_assets' );


// ─── 2. Add type="module" to the script tag ────────────────────────────────────

function tbm_script_module_type( $tag, $handle, $src ) {
	if ( $handle === 'tbm-js' ) {
		return '<script type="module" src="' . esc_url( $src ) . '"></script>' . "\n";
	}
	return $tag;
}
add_filter( 'script_loader_tag', 'tbm_script_module_type', 10, 3 );


// ─── 3. Shortcode: [tech_bulletin_machines] ───────────────────────────────────

function tbm_shortcode() {
	wp_enqueue_style( 'tbm-css' );
	wp_enqueue_script( 'tbm-js' );

	ob_start();
	?>
	<div class="tbm-wrapper">

		<!-- ═══════════════ HOME VIEW ═══════════════════════════════════════════ -->
		<div id="homeView" class="home-view">
			<div class="home-page">
				<header class="hero home-hero">
					<p class="eyebrow">Machine Catalogue</p>
					<h1>Agricultural Machinery Data</h1>
					<p class="subhead">
						Select a machine category to view full specifications and compare units side-by-side.
					</p>
				</header>
				<div id="categoryGrid" class="category-grid" role="list"></div>
			</div>
		</div>

		<!-- ═══════════════ CATEGORY VIEW ═══════════════════════════════════════ -->
		<div id="categoryView" class="category-view" hidden>
			<div class="page">

				<button type="button" id="backBtn" class="back-btn">&#8592; All Categories</button>

				<header class="hero category-hero">
					<p class="eyebrow" id="categoryEyebrow">Machine Category</p>
					<h1 id="categoryTitle">Machine Specifications</h1>
					<p class="subhead">View full specifications and compare two units side-by-side.</p>
				</header>

				<section class="panel controls-panel" aria-label="Controls">
					<div class="control-row">
						<label for="searchInput">Search machine</label>
						<input id="searchInput" type="search" placeholder="Name, brand, model&hellip;" />
					</div>
					<div class="control-row">
						<label for="brandFilter">Filter by brand</label>
						<select id="brandFilter">
							<option value="">All brands</option>
						</select>
					</div>
				</section>

				<div class="tab-nav" role="tablist" aria-label="Machine views">
					<button
						type="button" class="tab-btn is-active" role="tab"
						aria-selected="true" aria-controls="machineListPanel"
						data-target="machineListPanel">
						Machine List
					</button>
					<button
						type="button" class="tab-btn" role="tab"
						aria-selected="false" aria-controls="comparePanel"
						data-target="comparePanel">
						Compare Machines
					</button>
				</div>

				<section id="machineListPanel" class="panel tab-panel is-active" aria-label="Machine list">
					<div class="section-head">
						<h2>Machines</h2>
						<p id="listCount">0 items</p>
					</div>
					<div id="machineList" class="machine-list"></div>
				</section>

				<section id="comparePanel" class="panel tab-panel" aria-label="Compare machines">
					<div class="section-head">
						<h2>Compare Two Machines</h2>
					</div>
					<div class="compare-controls">
						<div class="control-row">
							<label for="machineA">Machine A</label>
							<select id="machineA"></select>
						</div>
						<div class="control-row">
							<label for="machineB">Machine B</label>
							<select id="machineB"></select>
						</div>
						<label class="check">
							<input id="differencesOnly" type="checkbox" />
							Show differences only
						</label>
					</div>

					<div class="compare-image-row">
						<article class="compare-machine-card">
							<h3 id="machineAImageHeading">Machine A</h3>
							<div class="compare-photo-wrap">
								<div id="machineAPhotoPlaceholder" class="machine-photo-placeholder"></div>
								<img id="machineAPhoto" class="machine-photo" alt="" hidden />
							</div>
						</article>
						<article class="compare-machine-card">
							<h3 id="machineBImageHeading">Machine B</h3>
							<div class="compare-photo-wrap">
								<div id="machineBPhotoPlaceholder" class="machine-photo-placeholder"></div>
								<img id="machineBPhoto" class="machine-photo" alt="" hidden />
							</div>
						</article>
					</div>

					<div class="table-wrap">
						<table id="compareTable" class="compare-table">
							<thead>
								<tr>
									<th>Specification</th>
									<th id="machineAHeading">Machine A</th>
									<th id="machineBHeading">Machine B</th>
								</tr>
							</thead>
							<tbody id="compareBody"></tbody>
						</table>
					</div>
				</section>

			</div><!-- /.page -->
		</div><!-- /#categoryView -->

		<!-- Machine card template (hidden, cloned by JS) -->
		<template id="machineCardTemplate">
			<article class="machine-card">
				<div class="machine-photo-wrap">
					<div class="machine-photo-placeholder"></div>
					<!-- alt is set dynamically by JS when a photo URL is present -->
					<img class="machine-photo" alt="" hidden />
				</div>
				<div class="machine-content">
					<h3 class="machine-name"></h3>
					<p class="machine-type"></p>
					<p class="machine-requested-by"></p>
					<div class="machine-actions">
						<button type="button" class="details-toggle" aria-expanded="false">
							Show detailed specifications
						</button>
						<button type="button" class="print-btn" aria-label="Print bulletin">
							<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 0.3rem;"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg> Print
						</button>
					</div>
					<div class="machine-spec-details" hidden></div>
				</div>
			</article>
		</template>

		<button type="button" id="scrollTopBtn" class="scroll-top-btn" aria-label="Back to top" hidden>
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg>
		</button>

	</div><!-- /.tbm-wrapper -->
	<?php
	return ob_get_clean();
}
add_shortcode( 'tech_bulletin_machines', 'tbm_shortcode' );