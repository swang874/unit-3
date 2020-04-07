//Scriptsheet by Shujin Wang, 2020
//wrap everything in a self-executing anonymous function to move to local scope
(function(){
//pseudo-global variables for data join
var attrArray = ["hospop", "c325pop", "d325c", "c401pop", "d401c"]; //list of attributes
var expressed = attrArray[2]; //initial attribute

//begin script when window loads
window.onload = setMap();

//set up choropleth map
function setMap(){
    //map frame dimensions
    var width = window.innerWidth * 0.5,
        height = 460;

    //create new svg container for the map
    var map = d3.select("body")
        .append("svg")
        .attr("class", "map")
        .attr("width", width)
        .attr("height", height);

    //create Albers equal area conic projection centered on Spain
    var projection = d3.geoAlbers()
        .center([0, 40])
        .rotate([3, 0, 0])
        .parallels([38, 42])
        .scale(2500)
        .translate([width / 2, height / 2]);
    var path = d3.geoPath()
        .projection(projection);

    //create Albers equal area conic projection centered on Canary Islands
    var projection2 = d3.geoAlbers()
        .center([0, 28.3])
        .rotate([15.9, 0, 0])
        .parallels([28, 28.6])
        .scale(3500)
        .translate([350 / 2, 200 / 2]);
    var path2 = d3.geoPath()
        .projection(projection2);

    //use Promise.all to parallelize asynchronous data loading
    var promises = [];
    promises.push(d3.csv("data/unitsData.csv")); //load attributes from csv
    promises.push(d3.json("data/otherCountries.topojson")); //load background spatial data
    promises.push(d3.json("data/SpainRegions.topojson")); //load choropleth spatial data
    Promise.all(promises).then(callback);

    function callback(data){
      	csvData = data[0];
        other = data[1];
      	spain = data[2];

        //place graticule on the map
        setGraticule(map, path, 5);

        //translate other countries and spain TopoJSONs
        var otherCountries = topojson.feature(other, other.objects.ne_10m_admin_0_countries);
        var spainRegions = topojson.feature(spain, spain.objects.ESP_adm1).features;

        //add other countries to map
        var countries = map.append("path")
            .datum(otherCountries)
            .attr("class", "countries")
            .attr("d", path);

        //join csv data to GeoJSON enumeration units
        spainRegions = joinData(spainRegions, csvData);

        //create the color scale
        var colorScale = makeColorScale(csvData);

        //add enumeration units to the map
        setEnumerationUnits(spainRegions, map, path, colorScale);

        //add coordinated visualization to the map
        setChart(csvData, colorScale);

        //create new svg container for Canary Islands, place graticule and add enumeration units
        var map2 = d3.select("body")
            .append("svg")
            .attr("class", "map")
            .attr("width", 350)
            .attr("height", 200);
        setGraticule(map2, path2, 2);
        setEnumerationUnits(spainRegions, map2, path2, colorScale);
    };
};

function setGraticule(map, path, n){
    //create graticule generator
    var graticule = d3.geoGraticule()
        .step([n, n]); //place graticule lines every 5 degrees of longitude and latitude

    //create graticule background
    var gratBackground = map.append("path")
        .datum(graticule.outline()) //bind graticule background
        .attr("class", "gratBackground") //assign class for styling
        .attr("d", path) //project graticule

    //create graticule lines
    var gratLines = map.selectAll(".gratLines") //select graticule elements that will be created
        .data(graticule.lines()) //bind graticule lines to each element to be created
        .enter() //create an element for each datum
        .append("path") //append each element to the svg as a path element
        .attr("class", "gratLines") //assign class for styling
        .attr("d", path); //project graticule lines
};

function joinData(spainRegions, csvData){
    //loop through csv to assign each set of csv attribute values to geojson region
    for (var i=0; i<csvData.length; i++){
        var csvRegion = csvData[i]; //the current region
        var csvKey = csvRegion.name; //the CSV primary key

        //loop through geojson regions to find correct region
        for (var a=0; a<spainRegions.length; a++){
            var geojsonProps = spainRegions[a].properties; //the current region geojson properties
            var geojsonKey = geojsonProps.NAME_1; //the geojson primary key

            //where primary keys match, transfer csv data to geojson properties object
            if (geojsonKey == csvKey){
                //assign all attributes and values
                attrArray.forEach(function(attr){
                    var val = parseFloat(csvRegion[attr]); //get csv attribute value
                    geojsonProps[attr] = val; //assign attribute and value to geojson properties
                });
            };
        };
    };
    return spainRegions;
};

//function to create color scale generator
function makeColorScale(data){
    var colorClasses = [
        "#ffe1b0",
        "#fdcc8a",
        "#fc8d59",
        "#e34a33",
        "#b30000"
    ];

    //create color scale generator
    var colorScale = d3.scaleQuantile()
        .range(colorClasses);

    //build array of all values of the expressed attribute
    var domainArray = [];
    for (var i=0; i<data.length; i++){
        var val = parseFloat(data[i][expressed]);
        domainArray.push(val);
    };

    //cluster data using ckmeans clustering algorithm to create natural breaks
    var clusters = ss.ckmeans(domainArray, 5);
    //reset domain array to cluster minimums
    domainArray = clusters.map(function(d){
        return d3.min(d);
    });
    //remove first value from domain array to create class breakpoints
    domainArray.shift();

    //assign array of last 4 cluster minimums as domain
    colorScale.domain(domainArray);

    return colorScale;
};

function setEnumerationUnits(spainRegions, map, path, colorScale){
    //add Spain regions to map
    var regions = map.selectAll(".regions")
        .data(spainRegions)
        .enter()
        .append("path")
        .attr("class", function(d){
            return "regions " + d.properties.NAME_1;
        })
        .attr("d", path)
        .style("fill", function(d){
            var value = d.properties[expressed];
            if(value) {
            	return colorScale(d.properties[expressed]);
            } else {
            	return "#ccc";
            }
        });
};

//function to create coordinated bar chart
function setChart(csvData, colorScale){
    //chart frame dimensions
    var chartWidth = window.innerWidth * 0.425,
        chartHeight = 460;

    //create a second svg element to hold the bar chart
    var chart = d3.select("body")
        .append("svg")
        .attr("width", chartWidth)
        .attr("height", chartHeight)
        .attr("class", "chart");

    //create a scale to size bars proportionally to frame
    var yScale = d3.scaleLinear()
        .range([0, chartHeight])
        .domain([0, 120]);

    //set bars for each region
    var bars = chart.selectAll(".bars")
        .data(csvData)
        .enter()
        .append("rect")
        .sort(function(a, b){
            return a[expressed]-b[expressed]
        })
        .attr("class", function(d){
            return "bars " + d.name;
        })
        .attr("width", chartWidth / csvData.length - 1)
        .attr("x", function(d, i){
            return i * (chartWidth / csvData.length);
        })
        .attr("height", function(d){
            return yScale(parseFloat(d[expressed]));
        })
        .attr("y", function(d){
            return chartHeight - yScale(parseFloat(d[expressed]));
        })
        .style("fill", function(d){
            return colorScale(d[expressed]);
        });

    //annotate bars with attribute value text
    var numbers = chart.selectAll(".numbers")
        .data(csvData)
        .enter()
        .append("text")
        .sort(function(a, b){
            return a[expressed]-b[expressed]
        })
        .attr("class", function(d){
            return "numbers " + d.name;
        })
        .attr("text-anchor", "middle")
        .attr("x", function(d, i){
            var fraction = chartWidth / csvData.length;
            return i * fraction + (fraction - 1) / 2;
        })
        .attr("y", function(d){
            return chartHeight - yScale(parseFloat(d[expressed])) + 15;
        })
        .text(function(d){
            return Math.round(d[expressed]);
        });

    //create a text element for the chart title
    var chartTitle = chart.append("text")
        .attr("x", 20)
        .attr("y", 40)
        .attr("class", "chartTitle")
        .text("Number of Deaths per 1000 Cases of COVID-19 on Mar 25th");
};
})();
