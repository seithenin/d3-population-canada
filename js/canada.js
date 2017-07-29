d3.queue()
	.defer(d3.json, "/data/ca-q-pop.json")
	//.defer(d3.json, "./provincial_data/population-data.json")
	.await(function(error, can) {
		if (error) throw error;


			// ============ CHART SETUP ================ //

			// ------------ CHART SETUP: sizing and layout -------//
			var margin = { top: 100, right: -70, bottom: 0, left: -70 };
			var height = 600 + margin.top + margin.bottom;
			var width = 960 + margin.right + margin.left;

			// ----------- CHART SETUP: map of total population by province from 2012 to 2016
			var svg = d3.select("#map").append('svg').attr('height', height).attr('width', width).attr('class', 'background');
			// ----------- CHART SETUP: map of rate of growth of each province from 2012 to 2016
			var svgGrowth = d3.select("#map-growth").append('svg').attr('height', height).attr('width', width).attr('class', 'background');

			// path generator
			var path = d3.geoPath();

			// tooltip creation
			var tooltip = d3.select('body').append('div').attr('class', 'tooltip');
			var tooltipParams = { x: -70, y: -70};

			// ----------- CHART SETUP: color scale total population
			// -----------   create the color scales to be used for total population chart
			var colors = d3.scaleLog()
				// -------- specify the domain, this is found by getting the smallest value 
				// --------		from the existing objects, d3.min() finds the minimum value
				// --------		however, because values are nested, need to make use of a method
				// --------		to return the proper nested value. The same process is used for d3.max
				.domain([d3.min(can.objects.tracts.geometries, function(e){ 
					return Number(e.properties.year_2012); 
				}), d3.max(can.objects.tracts.geometries, function(e){ 
					return Number(e.properties.year_2016); 
				}) ])
				.range(['#4ca9ff', '#00427f']);

			// ----------- CHART SETUP: color scale growth rate
			// create the color scale for growth chart
			var growthColors = d3.scaleLinear()
				.domain([0, 10]) // using a static range that goes beyond the limits of the dataset
				.range(['#ffffff', '#156e17']);

			// ----------- CHART SETUP: maping years
			var yearMap = { 
				'2012' : "year_2012", 
				'2013' : "year_2013", 
				'2014' : "year_2014", 
				'2015' : "year_2015", 
				'2016' : "year_2016"
			}

			var activeYear = "2016";

			// ============== LEGENDS ===================//
			// -------------- LEGENDS: interpolation used to divide the legend into segments
			// --------------    gradients were chosen over this method
			// var iProv = d3.interpolate(0, (14000/10)); // 10 segments of 0 to 14,000
			// var iProvValues = [];
			// for(var i = 0; i < 10; i++) {
			// 	iProvValues[i] = iProv(i);
			// }

			var legendHeight = 10;
			var legendWidth = 250;

			// ------------ LEGENDS: Gradients in SVG are created using definitions (defs) with a unique
			//		id that can be referenced later (by the definition)
			var defs = svg.append('defs');
			var provGradient = defs.append('linearGradient') // a SVG element that works only when nested in a 'defs' element
				.attr('id', 'linear-gradient-1');
			provGradient.attr('x1', '0%').attr('x2', '100%').attr('y1', '0%').attr('y2', '0%');

			// ------------ repeat for growth chart
			var defsGrowth = svgGrowth.append('defs');
			var growthGradient = defs.append('linearGradient')
				.attr('id', 'linear-gradient-growth');
			growthGradient.attr('x1', '0%').attr('x2', '100%').attr('y1', '0%').attr('y2', '0%');

			// ------------ LEGENDS: manual gradient creation
			// ------------     add gradient colors using the stop svg element

			// This function is tightly coupled, relised on activeYear and yearMap and the colors scale
			//	it just performs the calculations necessary to determine the color
			//	value at each point
			function legendColorPicker(identifier) {
				switch(identifier) {
					case "start":
						return colors(d3.min(can.objects.tracts.geometries, function(e) {
								return Number(e.properties[yearMap[activeYear]]);
							}));
					case "middle":
							return colors( ( (d3.min(can.objects.tracts.geometries, function(e) {
								return Number(e.properties[yearMap[activeYear]])
								})) + (d3.max(can.objects.tracts.geometries, function(e) {
								return Number(e.properties[yearMap[activeYear]])
								})) ) / 2 );
					case "end":
							return colors(d3.max(can.objects.tracts.geometries, function(e) {
								return Number(e.properties[yearMap[activeYear]]);
							}));
					}
			}

			// provGradient.append('stop')
			// 	.attr('offset', '0%') // what exact location will the exact color appear
			// 	.attr('stop-color', '#4ca9ff'); //define the color
			// provGradient.append('stop')
			// 	.attr('offset', '100%')
			// 	.attr('stop-color', '#00427f');

			// using the color scale defined earlier
			provGradient.append('stop').attr('class', 'starting-color')
				.attr('offset', '0%')
				.attr('stop-color', legendColorPicker('start'));
			provGradient.append('stop').attr('class', 'middle-color')
				.attr('offset', '50%')
				.attr('stop-color',  legendColorPicker('middle'));
			provGradient.append('stop').attr('class', 'ending-color')
				.attr('offset', '100%')
				.attr('stop-color', legendColorPicker('end') );

			growthGradient.selectAll('stop').data(growthColors.range())
				.enter().append('stop').attr('offset', function(d,i) { return i/(growthColors.range().length-1);})
				.attr('stop-color', function(d) { return d; });

			// ============= SUPPORT METHODS ============
			// Pretty - method to prettify the population number
			// number - a value (decimal or otherwise) that is 1/1000 of the
			//	intended value
			// return - a new valued formatted in the region defined by the browser
			function pretty(number) {
				return (number*1000).toLocaleString(undefined);
			}

			// prettyPercent - method to round of percent values
			// number - the percent value that requires rounding
			// return - returns the value in the style of x.xx
			function prettyPercent(number) {
				return (number).toLocaleString('en-US', { maximumFractionDigits: 2});
			}

			// calcRate - calculates the growth rate between two values
			// cur - the current size
			// old - the previous size 
			// return - the rate as a percent
			function calcRate(cur, old) {
				return ((cur - old)/old) * 100;
			}


			// =============== MAP ===================//
			// --------------- MAP: total population by province from 2012 to 2016
			var provinces = svg.append('g')
				.attr("transform", "translate(" + margin.left + ", " + margin.top + ")")
				.attr('class', 'provinces')
				.selectAll('path.prename')
				// topojson doesn't have features, so use this to convert
				//	to geojson and use the features parameter from it
				.data(topojson.feature(can, can.objects.tracts).features)
				.enter()
				.append('path').attr('class', 'prename').attr('d', path)
					// fill according to the colors scale
					.attr('fill', function(d,i) { return colors(d.properties.year_2016); })
					// mouseover - apply tooltip details
					.on('mouseover', function(d) {
						tooltip.transition().duration(200).style('opacity', '1');
						//toLocaleString converts to browser's defined locale number info, 1,000 for US.
						tooltip.html(d.properties.PRENAME + '<br />' + activeYear +': ' + pretty(d.properties[yearMap[activeYear]])

							// '2012: ' + pretty(d.properties.year_2012) +
							// '<br />' + '2013: ' + pretty(d.properties.year_2013) + '<br />' +
							// '2014: ' + pretty(d.properties.year_2014) + '<br />' + 
							// '2015: ' + pretty(d.properties.year_2015) + '<br />' + 
							// '2016: ' + pretty(d.properties.year_2016)
							)
							.style('left', (d3.event.pageX + tooltipParams.x) + 'px')
							.style('top', (d3.event.pageY + tooltipParams.y) + 'px')
							.style('z-index', '1');
					})
					// mousemove - allows tooltip to follow the mouse pointer
					.on('mousemove', function(d) {
						tooltip.style('left', (d3.event.pageX + tooltipParams.x) + 'px')
							.style('top', (d3.event.pageY + tooltipParams.y) + 'px')
							.style('z-index', '1');
					})
					// mouseout - clear out the values when cursor leaves the region
					.on('mouseout', function(d) {
						tooltip.transition().duration(200).style('opacity', '0').style('z-index', '-1');
					});

			// ------------- MAP: borders ---------------
			// -------------   use topojson mesh to draw only one line where otherwise
			//					two lines would be drawn (for joining borders)
			//					however, there is no line drawn for the entire outline
			svg.append('path').attr('class', 'province-borders').attr("transform", "translate(" + margin.left + ", " + margin.top + ")")
				.attr('d', path(topojson.mesh(
						can, can.objects.tracts, function(a,b) { return a !== b; })
					)
				);

			// ------------ MAP: total population - interactive legend
			// ------------   allow the user to select the year to update the chart
			var selectByYear = svg.append('g').attr("transform", "translate(" + (width-100) + ", " + 100 + ")").attr('class', 'select-by-year');
			// ------------   create the selection area title
			selectByYear.append('text').attr('class', 'title').attr('x', 0).attr('y', 0).attr('text-anchor', 'middle').text('Select Year:');
			// ------------   create the buttons to choose from
			// ------------       each button is constructed of a group that contains one text element and one rectangle element
			var sbyButtons = selectByYear.append('g').attr("transform", "translate(" + -20 + ", " + 30 + ")")
				.selectAll('text.year')
				.data(['2012', '2013', '2014', '2015', '2016']).enter()
				.append('g')
				.attr("transform", function(d,i) { 
					return "translate(" + 0 + ", " + 30 * i + ")";
				})
				.attr('class', function(d) { 
					if (d === "2016") {
						return "year active";
					}
					else {
						return "year";
					}
				})
				// -------- functionality to select year, update the class information and tooltip details
				.on('click', function(d) {
					var activeClass = "active";
					var alreadyIsActive = d3.select(this).classed(activeClass);
					svg.selectAll('g.year').classed(activeClass, false);
					d3.select(this).classed('active', true);
					var temp = yearMap[d];
					activeYear = d;
					// update the color of the map
					d3.selectAll('path.prename')
						.attr('fill', function(d) { return colors(d.properties[temp]); });
					d3.select('text.legend-start')
						.text(pretty(d3.min(can.objects.tracts.geometries, function(e){ return Number(e.properties[yearMap[activeYear]]); }) ) );
					d3.select('text.legend-end')	
						.text(pretty(d3.max(can.objects.tracts.geometries, function(e){ return Number(e.properties[yearMap[activeYear]]); }) ) );
					d3.select('stop.starting-color')
						.attr('stop-color', legendColorPicker('start') );
					d3.select('stop.middle-color')
						.attr('stop-color', legendColorPicker('middle'));
					d3.select('stop.ending-color')
						.attr('stop-color', legendColorPicker('end'));
				});

			// add the button background
			sbyButtons.append('rect').attr('class', 'select-box').attr('x', -8).attr('y', -20).attr('width', 60).attr('height', 26);

			// add text element with year class OR year and active classes for initial construction
			sbyButtons.append('text')
				.attr('text-anchor', 'left').attr('x', 0)
				.attr('y', 0)
				//.attr('class', function(d, i) { if (d === "2016") return "active"; })
				.text(function(d){ return d;});

			// Title for the chart
			var title = svg.append('g').attr("transform", "translate(" + width/2 + ", " + 50 + ")").attr('class', 'title')
				.append('text').attr('text-anchor', 'middle').text('Population of Canada by Province from 2012 to 2016');

			// add the legend, a gradient bar with the min and max values for the population
			var legend = svg.append('g')
				.attr("transform", "translate(" + 50 + ", " + 100 + ")").attr('class', 'legend');

			legend.append('rect')
				.attr('height', legendHeight).attr('width', legendWidth)
				.style('fill', 'url(#linear-gradient-1)');
			legend.append('text').attr('class','legend-start').attr('text-anchor', 'middle').attr('x', 0).attr('y', legendHeight + 15)
				.text(pretty(d3.min(can.objects.tracts.geometries, function(e){ return Number(e.properties[yearMap[activeYear]]); }) ) );

			legend.append('text').attr('class', 'legend-end').attr('text-anchor', 'middle').attr('x', legendWidth).attr('y', legendHeight + 15)
				.text(pretty(d3.max(can.objects.tracts.geometries, function(e){ return Number(e.properties[yearMap[activeYear]]); }) ) );


			// ------------------ MAP: growth rate per province
			svgGrowth.append('g').attr("transform", "translate(" + margin.left + ", " + margin.top + ")")
				.attr('class', 'provinces')
				.selectAll('path')
				.data(topojson.feature(can, can.objects.tracts).features)
				.enter()
				.append('path').attr('d', path).attr('class','growthname')
					.attr('fill', function(d,i) { return growthColors(calcRate(d.properties.year_2016, d.properties.year_2012)); })
					.attr('stroke', 'black')
					.on('mouseover', function(d) {
						tooltip.transition().duration(200).style('opacity', '.9');
						tooltip.html(d.properties.PRENAME + '<br />' + prettyPercent(calcRate(d.properties.year_2016, d.properties.year_2012)) + '%')
						.style('left', (d3.event.pageX + tooltipParams.x) + 'px')
						.style('top', (d3.event.pageY + tooltipParams.y) + 'px')
						.style('z-index', '1');
					})
					.on('mousemove', function(d){
						tooltip.style('left', (d3.event.pageX + tooltipParams.x) + 'px')
						.style('top', (d3.event.pageY + tooltipParams.y) + 'px')
						.style('z-index', '1');
					})
					.on('mouseout', function(d) {
						tooltip.transition().duration(200).style('opacity', '0').style('z-index', '-1');
					});

			// ------------------ MAP: growth - title
			var titleGrowth = svgGrowth.append('g').attr("transform", "translate(" + width/2 + ", " + 50 + ")").attr('class', 'title')
				.append('text').attr('text-anchor', 'middle').text('Growth Rate per Province from 2012 to 2016');

			var legendGrowth = svgGrowth.append('g').attr("transform", "translate(" + 50 + ", " + 100 + ")");
			legendGrowth.append('rect').attr('height', legendHeight).attr('width', legendWidth)
				.style('fill', 'url(#linear-gradient-growth)');
			legendGrowth.append('text').attr('text-anchor', 'middle').attr('x', 0).attr('y', legendHeight + 15)
				.text(d3.min(growthColors.domain()) + '%');
			legendGrowth.append('text').attr('text-anchor', 'middle').attr('x', legendWidth).attr('y', legendHeight + 15)
				.text(d3.max(growthColors.domain()) + '%');
				
	});

/*              __
               / _)         
        .-^^^-/ /          
    __/       _/              
   <__.|_|-|_|              
*/

