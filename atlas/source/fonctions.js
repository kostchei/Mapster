
function isMobile() {
	if (/android|iphone|ipad|ipod|mobi|mini|tablet/i.test(navigator.userAgent) )
		return (true);
	else
		return (false);
}

function toggleSpoiler () {
	if ( $(".spoiler").css('visibility') === 'hidden')
		$(".spoiler").css("visibility","visible");
	else
		$(".spoiler").css("visibility","hidden");	
}

function getName(i) {
	var name;

	if (bilang)
	{
		if (lang == "fr")
		{
			if (typeof groupe[i].name0 !== 'undefined')
			{ name = groupe[i].name0;}
			else
			{ name = groupe[i].name1;}
		}
		else if (lang == "es")
		{
			if (typeof groupe[i].name2 !== 'undefined')
			{ name = groupe[i].name2;}
			else
			{ name = groupe[i].name1;}
		}
		else
		{
			if (typeof groupe[i].name1 !== 'undefined')
			{ name = groupe[i].name1;}
			else
			{ name = groupe[i].name0;}
		}
	}
	else
		{ name = groupe[i].name;}

	return (name);
}

function getDescr(i) {
	var text;

	if (bilang)
	{
		if (lang == "fr")
		{
			if (typeof groupe[i].txt0 !== 'undefined' && groupe[i].txt0 != '')
				text = groupe[i].txt0;
			else
				text = groupe[i].txt1;
		}
		else if (lang == "es")
		{
			if (typeof groupe[i].txt2 !== 'undefined' && groupe[i].txt2 != '')
				text = groupe[i].txt2;
			else
				text = groupe[i].txt1;
		}
		else
		{
			if (typeof groupe[i].txt1 !== 'undefined' && groupe[i].txt1 != '')
				text = groupe[i].txt1;
			else
				text = "";
		}
	}
	else
		{ text = groupe[i].txt;}

	text = text.replace("<%>", "<p class='lock'><i class='fa-solid fa-lock' title='Spoiler' onclick='toggleSpoiler()'></i></p><p class='spoiler'>");

	return (text);
}

function setPoints(mode) {

	if ((viewPoints == 0) || ((viewPoints == 1) && (mode == 2)))
	{
//		dot.remove();
		$("[id^='circ']").remove();
		var x=y=0;
		var nbrGrp=into=0;

		var Ptv1 = $('#ptv1').prop('checked');
		var Ptv2 = $('#ptv2').prop('checked');
		var Ptv3 = $('#ptv3').prop('checked');
		var Ptv4 = $('#ptv4').prop('checked');
		var Ptv5 = $('#ptv5').prop('checked');
		var Ptv6 = $('#ptv6').prop('checked');
		var Ptv7 = $('#ptv7').prop('checked');
		var Ptv8 = $('#ptv8').prop('checked');
		var Ptv9 = $('#ptv9').prop('checked');
		var Ptv10 = $('#ptv10').prop('checked');

		for (var i=0; i<groupe.length; i++)
		{
			into=0;

			nameP = getName(i);

			if (nameP == "GROUP")
				nbrGrp++;

			switch(nbrGrp) {
				case (1): if (Ptv1==1) into=1; break;
				case (2): if (Ptv2==1) into=1; break;
				case (3): if (Ptv3==1) into=1; break;
				case (4): if (Ptv4==1) into=1; break;
				case (5): if (Ptv5==1) into=1; break;
				case (6): if (Ptv6==1) into=1; break;
				case (7): if (Ptv7==1) into=1; break;
				case (8): if (Ptv8==1) into=1; break;
				case (9): if (Ptv9==1) into=1; break;
				case (10): if (Ptv10==1) into=1; break;
			}

			if (into)
			{
	 			x= groupe[i].x;
				if (x != 0)
				{
					y= groupe[i].y;
					if (bilang)
						nameS = groupe[i].name1;
					else
						nameS = groupe[i].name;

					if (carte=="F" && groupe[i].t==1)		// pour certains carrés sur la map de Faerun
						dot = map.rect(x-dotWidth,y-dotWidth, dotWidth+8,dotWidth+8).attr({fill: groupe[i].color, stroke: "black", "stroke-width": dotTrait, cursor: "pointer"});
					else
						dot = map.circle(x,y,dotWidth).attr({fill: groupe[i].color, stroke: "black", "stroke-width": dotTrait, cursor: "pointer"});
					dot.node.id = 'circ'+i;

					dot.node.nameP = nameP;

					if (nameP != nameS)
						dot.node.nameS = "<h3>[ "+nameS+" ]</h3>";
					else
						dot.node.nameS = "";

					var text = getDescr(i);
					if (typeof groupe[i].img !== 'undefined') text += "<p>"+groupe[i].img+"</p>";
					dot.node.text = text;

					dot.click(function(){
						nameP = this.node.nameP;		
						pinurl = nameP.replaceAll(" ", "_");
						pinurl = "https://www.aidedd.org/atlas/"+path+url+"@"+pinurl;
						
						if (viewText==1)
						{
							$('#txt').html("<h2>"+this.node.nameP+" <a href=\""+pinurl+"\"><i class='fa-solid fa-thumbtack'></i></a><i id='eye' class='fa-solid fa-eye-slash' title='"+LgHideDescr+"' onclick='fixText()'></i></h2>"+this.node.nameS+this.node.text);
							$('#txt h3').show();
							$('#txt p').show();
							$('#txt ul').show();
						}
						else
						{
							$('#txt').html("<h2>"+this.node.nameP+" <a href=\""+pinurl+"\"><i class='fa-solid fa-thumbtack'></i></a><i id='eye' class='fa-solid fa-eye' title='"+LgShowDescr+"' onclick='fixText()'></i></h2>"+this.node.nameS+this.node.text);
							$('#txt h3').hide();
							$('#txt p').hide();
							$('#txt ul').hide();
						}
						showDescr();
					});
				}
			}
		}
		if (mode != 2)
			viewPoints = 1;
	}
	else
	{
		$("[id^='circ']").remove();
		if (mode != 2)
			viewPoints = 0;
	}

	if (mode == 1)
		$('#menu').toggle();
}

function fixText() {
	if (viewText == 1)
	{
		viewText = 0;
		$('#txt h3').hide();
		$('#txt p').hide();
		$('#txt ul').hide();
		$('#eye').removeClass("fa-eye-slash");
		$('#eye').addClass("fa-eye");
		$('#eye').attr('title', LgShowDescr);
	}
	else
	{
		viewText = 1;
		$('#txt h3').show();
		$('#txt p').show();
		$('#txt ul').show();
		$('#eye').removeClass("fa-eye");
		$('#eye').addClass("fa-eye-slash");
		$('#eye').attr('title', LgHideDescr);
	}
}

function toogleZones() {
	if (viewZones == 0)
	{
		$("[id^='zone']").animate({"fill-opacity":0.5}, 300);
		viewZones = 1;
	}
	else
	{
		$("[id^='zone']").animate({"fill-opacity":0}, 300);
		viewZones = 0;
	}
}

function affichePoint(search) {
//	dot.remove();

	if (multipleSearch == 0)
	{
		$("[id^='circ']").remove();
		$('#exch-icon').show();
	}
	else if (multipleSearch == 1)
	{
		multipleSearch = 0;
	}

	var x = y = 0;
	viewPoints = 0;

	for (var i=0; i<groupe.length; i++)
	{
		nameP = getName(i);
		if (bilang)
			nameS = groupe[i].name1;
		else
			nameS = groupe[i].name;

		if (search == nameP || search == nameS)
		{
			x= groupe[i].x;
			y= groupe[i].y;

			var text = getDescr(i);
			pinurl = nameP.replaceAll(" ", "_");
			pinurl = "https://www.aidedd.org/atlas/"+path+url+"@"+pinurl;

			if (viewText==1)
			{
				var descr = "<h2>"+nameP+" <a href=\""+pinurl+"\"><i class='fa-solid fa-thumbtack'></i></a><i id='eye' class='fa-solid fa-eye-slash' title='"+LgHideDescr+"' onclick='fixText()'></i></h2>";
				if (nameP != nameS) descr += "<h3>[ "+nameS+" ]</h3>";
				descr += text;
				if (typeof groupe[i].img !== 'undefined') descr += "<p>"+groupe[i].img+"</p>";
				$('#txt').html(descr);
				$('#txt h3').show();
				$('#txt p').show();
				$('#txt ul').show();
			}
			else
			{
				var descr = "<h2>"+nameP+" <a href=\""+pinurl+"\"><i class='fa-solid fa-thumbtack'></i></a><i id='eye' class='fa-solid fa-eye' title='"+LgShowDescr+"' onclick='fixText()'></i></h2>";
				if (nameP != nameS) descr += "<h3>[ "+nameS+" ]</h3>";
				descr += text;
				if (typeof groupe[i].img !== 'undefined') descr += "<p>"+groupe[i].img+"</p>";
				$('#txt').html(descr);
				$('#txt h3').hide();
				$('#txt p').hide();
				$('#txt ul').hide();
			}
			showDescr();

			if (x != 0)
			{
				if (carte=="F" && groupe[i].t==1)		// pour certains carrés sur la map de Faerun
				{
					dot = map.rect(x-dotWidth,y-dotWidth, 0,0).attr({fill: groupe[i].color, stroke: "black", "stroke-width": dotTrait, cursor: "pointer"});
					dot.animate({width:dotWidth+8, height:dotWidth+8}, 3000, "elastic");
				}
				else
				{
					dot = map.circle(x,y, 0).attr({fill: groupe[i].color, stroke: "black", "stroke-width": dotTrait, cursor: "pointer"});
					dot.animate({r:dotWidth}, 3000, "elastic");
				}
				dot.node.id = 'circ'+i;
				dot.click(function(){$('#txt').html(descr); showDescr();});

				/* centre sur le point cherché */
				offsetXU = x-imageW/2;
				offsetYU = y-imageH/2;
				setZoom(0);
			}
			break;
		}
	}
}

function unshowDescr() {
	if ($('#descr').is(":visible"))
		$('#descr').slideUp(250);
}

function showDescr() {
	if ($('#descr').is(":hidden"))
		$('#descr').slideDown(250);
}

function clearSearch() {
	if ( $("#search").val() == LgSearch)
	{
		$("#search").val('');
		$("#search").removeClass('txtgris');
		$('#search-icon').hide();
		$('#del-icon').show();
	}
}

function setSearch() {
	$("#search").val(LgSearch);
	$("#search").addClass('txtgris');
	$('#search-icon').show();
	$('#del-icon').hide();
	$('#exch-icon').hide();
	$('#txt').html('');
	$("#autocomplete").html('');
	unshowDescr();
}

function MultipleSearch() {
	$("#search").val('');
	$('#txt').html(LgExch);
	$('#exch-icon').hide();
	multipleSearch = 1;
}

function toggleMenu() {
	$('#menu').toggle();
}

$(function() {
	$("#search").on('input', function(e) {
		const recherche = $("#search").val().toLowerCase();

		if (recherche.length >=3)
		{
			var liste = '';

			for (lieux of availableName) {
				if (lieux.match(RegExp(recherche, "i")))
					liste += `<li>${lieux}</li>`;
			}
			for ([lieux, texte] of availableText) {
				if (texte.match(RegExp(recherche, "i")) && (!(liste.includes(lieux))))
					liste += `<li class="txt">${lieux}</li>`;
			}
			$("#autocomplete").html(liste);
		}
		else
			$("#autocomplete").html('');
	});

	$("#autocomplete").click(function(e) {
		$("#search").val(e.target.textContent);
		var loc = e.target.textContent;
		affichePoint(loc);
		$("#autocomplete").html('');
		$("#search").val('');
	});
});

function test() {
	$('#menu').toggle();
	$('#txt').html(LgTest);
	showDescr();
}

function trajet(start) {
	if (start == 1)
		$('#menu').toggle();
	else
		$('#menu').hide();
	$("[id^='line']").remove();
	$('#txt').html(LgStartTra);
	showDescr();
	drawing = 1;
}

$(document).keyup(function(e) {
	if (e.keyCode === 27)		// escape
	{
		if (drawing == 2)
		{
			$("[id^='line']").remove();
			$('#txt').html(LgStartTra);
			distance = 0;
			drawing = 1;
			showDescr();
		}
		else
		{
			setSearch();
			drawing = 0;
		}
	}
});

$(document).keydown(function(e) {

	if(e.ctrlKey && e.keyCode == 'A'.charCodeAt(0)) {
		e.preventDefault();
		setPoints(0);
	}
	else if(e.ctrlKey && e.keyCode == 'D'.charCodeAt(0)) {
		e.preventDefault();
		trajet(0);
	}
	else if (e.keyCode == 107) setZoom(zoomStrong);	// + = zoom+
	else if (e.keyCode == 109) setZoom(-zoomStrong)	// - = zoom-
	else
	{
		switch (e.which) {
			case 37: // fleche gauche
				offsetXU = offsetXU - moveStep/zoom; moveMap(); break;
			case 38: // fleche haut
				offsetYU = offsetYU - moveStep/zoom; moveMap(); break;
			case 39: // fleche droite
			 	offsetXU = offsetXU + moveStep/zoom; moveMap(); break;
			case 40: // fleche bas
			 	offsetYU = offsetYU + moveStep/zoom; moveMap(); break;
		}
	}
});

$(document).on('wheel', function(e) {
	if (e.originalEvent.deltaY > 0)
		setZoom(-zoomLite);
	else
		setZoom(zoomLite);
});

function setZoom(z) {

	var tailleX, tailleY;

	if (zoom < 0.2 && imageW > 10000) // cas special Greyhawk
	{
		z= z*1.6;
	}

	if (z == 0)
	{
		zoom = 1;
	}
	else if (z > 0)
	{
		zoom = Math.round(zoom * Math.abs(z) * 1000)/1000;
		if (zoom > zoomMax)
			zoom = zoomMax;
	}
	else if (z < 0)
	{
		zoom = Math.round(zoom / Math.abs(z) * 1000)/1000;
		if (imageW*zoom < screenW && imageH*zoom < screenH)
			zoom = Math.round(Math.min(screenW/imageW,screenH/imageH) * 1000)/1000;
	}

	tailleX=parseInt(imageW * zoom);
	tailleY=parseInt(imageH * zoom);
	$("#map").css('background-size', tailleX+'px '+tailleY+'px'); // <- the mess !
//console.log(zoom);
	moveMap();
}

function moveMap() {

	var offsetX, offsetY;
	var offsetWB, offsetWH;
	const MARGE = 80;

	offsetWB = (imageW*zoom - screenW)/2;
 	offsetHB = (imageH*zoom - screenH)/2;

	if (imageW*zoom < screenW)
	{
		offsetX = offsetWB;
		offsetXU = 0;
	}
	else
	{
		offsetX = offsetXU*zoom + offsetWB;
		if (offsetX < -MARGE)
		{
			offsetXU = -(offsetWB + MARGE)/zoom;
			offsetX = offsetXU*zoom + offsetWB;
			clickToMove = 0;
		}
		else if (offsetX > 2*offsetWB + MARGE)
		{
			offsetXU = (offsetWB+MARGE)/zoom;
			offsetX = offsetXU*zoom + offsetWB;
			clickToMove = 0;
		}
	}

	if (imageH*zoom < screenH)
	{
		offsetY = offsetHB;
		offsetYU = 0;
	}
	else
	{
		offsetY = offsetYU*zoom + offsetHB;

		if (offsetY < -MARGE)
		{
			offsetYU = -(offsetHB + MARGE)/zoom;
			offsetY = offsetYU*zoom + offsetHB;
			clickToMove = 0;
		}
		else if (offsetY > 2*offsetHB + MARGE)
		{
			offsetYU = (offsetHB+MARGE)/zoom;
			offsetY = offsetYU*zoom + offsetHB;
			clickToMove = 0;
		}
	}

	map.setViewBox( parseInt(offsetX/zoom), parseInt(offsetY/zoom), parseInt(screenW/zoom), parseInt(screenH/zoom), false);
	$("#map").css('background-position', -parseInt(offsetX)+'px ' + -parseInt(offsetY)+'px');
}

function dureeL(dist, vitesse, duree)
{
	var texte;
	var dureeJ = Math.floor (dist / vitesse);

	if (dureeJ <= 1)
		texte = dureeJ+LgJour;
	else
		texte = dureeJ+LgJours;

	var dureeH = Math.round (dist % vitesse * duree / vitesse);

	if (dureeH <= 1)
		texte = texte+dureeH+LgHeure;
	else
		texte = texte+dureeH+LgHeures;

	return (texte);
}

function dureeS(dist, vitesse)
{
	var texte;
	var dureeM = Math.floor (dist / vitesse);

	if (dureeM <= 1)
		texte = dureeM+LgMinute;
	else
		texte = dureeM+LgMinutes;
	return (texte);
}

function drawLine(x, y)
{
	line = map.path("M"+oldX+","+oldY+" L"+x+","+y);
	line.attr ("stroke", "#0000FF");
	line.attr ("stroke-width", 8);
	line.attr ("stroke-linecap", 'round');
	line.node.id = 'line'+idT;
	idT++;
	distance = distance + Math.sqrt((x-oldX)*(x-oldX) + (y-oldY)*(y-oldY)) / factorDist;

	var texte = LgEndTra+LgDist;

	if (carte == "L" || carte == "N" || carte == "W" || carte == "B" || carte == "M")
	{
		var distUS  = (distance*1000).toFixed(0);
		var distEUR = (distUS/3.333).toFixed(0);
		texte += distEUR + " m / " + distUS + " feet</p>" + LgDuree;		// ft/min

		texte += LgMarcheN + dureeS(distUS, 300) + "</p><p>";
		texte += LgMarcheR + dureeS(distUS, 400) + "<br />";
		texte += LgMarcheL + dureeS(distUS, 200) + "</p><p>";

		texte += LgRowboat + dureeS(distUS, 132) + "<br />";
		texte += LgKeelboat + dureeS(distUS, 88) + "</p>";
	}
	else
	{
		var distUS  = distance.toFixed(0);
		var distEUR = (distUS*1.5).toFixed(0);
		texte += distEUR + " km / " + distUS + " miles</p>" + LgDuree;		// mph

		texte += LgMarcheN+dureeL(distUS, 24, 8) + "</p><p>";
		texte += LgMarcheR+dureeL(distUS, 30, 8) + "<br />";
		texte += LgMarcheL+dureeL(distUS, 18, 8) + "</p><p>";

		texte += LgRowboat + dureeL(distUS, 12, 8) + "<br />";
		texte += LgKeelboat + dureeL(distUS, 24, 24) + "<br />";
		texte += LgSailing + dureeL(distUS, 48, 24) + "<br />";
		texte += LgWarship + dureeL(distUS, 60, 24) + "<br />";
		texte += LgLongship + dureeL(distUS, 72, 24) + "<br />";
		texte += LgGalley + dureeL(distUS, 96, 24) + "</p><p>";

		texte += LgGriffon + dureeL(distUS, 72, 11) + "<br />";
		texte += LgConstruct + dureeL(distUS, 192, 24) + "</p>";

	}
	$('#txt').html(texte);
	showDescr();

	oldX = x;
	oldY = y;
}