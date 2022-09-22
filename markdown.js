function md(data)
{
	return (`<p>${mdpreform(data)}</p>`.replace(/<p>\s*<\/p>/g, ""));
}
function mdpreform(data)
{
	var data = data
	.replace(/</gim, "&lt;")
	.replace(/\>/gim, "&gt;")

	//unorded lists
	.replace(/((^|\n)( {0,1}([*+-]) .+)(\n  .*)*)((^|\n)( {0,1}\4 .+)(\n  .*)*)*/g, "</p><ul>$&\n</ul><p>")
	.replace(/(^|\n) {0,1}[*+-]( +|\t)((.*)(\n\2.*)+)/gi, function(m, nl, nl1, t) {
		return `<li>${md(t.replace(/(^|\n)(  )+/g, "$1")).replace(/(<\/p>|<p>)/g, "")}</li>`;
	})
	.replace(/(^|\n) {0,1}[*+-]( +|\t)(.*)/g, "$1<li>$3</li>")

	//orded lists
	.replace(/((^|\n)( {0,1}(\d+)\. .+)(\n  .*)*)((^|\n)( {0,1}(\d+\.) .+)(\n  .*)*)*/g, '</p><ol start="$4">$&\n</ol><p>')
	.replace(/(^|\n) {0,1}(\d+\.)( +|\t)((.*)(\n\3.*)+)/gi, function(m, nl, nl1, nl2, t) {
		return `<li>${md(t.replace(/(^|\n)( {2,})/g, "$1")).replace(/(<\/p>|<p>)/g, "")}</li>`;
	})
	.replace(/(^|\n) {0,1}(\d+\.)( +|\t)(.*)/g, "$1<li>$4</li>")
	
	//codeblocks
	.replace(/(^|\n)```(.*)\n((.*\n)+)```(\n|$)/g, function(m, nl, lang, t) {
		return `</p><pre${(lang ? " lang=\""+lang+"\"": "")}>${t
			.replace(/\n/g, "<br>")
		}</pre><p>`;
	})

	//quote blocks
	.replace(/(^|\n)((&gt; [^\n]*\n)(&gt;\s*\n|[^\n]+\n|&gt; [^\n]*\n)*)/gi, function(m, nl, t) {
		return `</p><mdqb>${md(t.replace(/(^|\n)&gt; {0,1}/g, "\n"))}</mdqb><p>`;
	})

	// Tables
	.replace(/(((^|\n)\|(.*)\|)+)/gi, function(m) {
		var lines = m.split('\n');
		if (lines[0] == "")
			lines.shift();

		var width = 0;
		var tablestr = "";

		var table = [[], []];
		var tablealignment = [];

		//validate table
		if (lines.length > 2)
		{
			lines[0].replace(/\|([^|\n]+)/g, (m, d) => {
				table[0][width++] = d.trim();
				return "";
			});
			
			lines[1].replace(/\|(([:-])[-]+([:-]))/g, (m, d, l, r) => {
				var align = "";
				if (l == ":" && r == ":")
					align = "center";
				else if (l == "-" && r == ":")
					align = "right";
				else
					align = "left";
				tablealignment.push(align);
				return "";
			});
		}

		if (tablealignment.length == width && lines.length > 2)
		{
			var i = 2;
			while (i < lines.length)
			{
				var j = 0;
				table[i-1] = [];
				lines[i].replace(/\|([^|\n]+)/g, (m, d) => {
					table[i-1][j++] = d.trim();
					return "";
				});
				if (j != width)
				{
					table.pop()
					break;
				}
				i++;
			}
			tablestr += "<tbody><tr>"
			for (var j = 0; j < width; j++)
			{
				tablestr += `<th style="text-align : ${tablealignment[j]};">${table[0][j]}</th>`
			}
			tablestr += "</tr>"

			for (var i = 1; i < table.length; i++)
			{
				tablestr += "<tr>"
				for (var j = 0; j < width; j++)
				{
					tablestr += `<td style="text-align : ${tablealignment[j]};">${table[i][j]}</td>`
				}
				tablestr += "</tr>"
			}
			tablestr += "</tbody>"

			return(`</p><table>${tablestr}</table><p>`);
		}

		console.log(table);

		return (m);
	})

	//headers
	.replace(/^(#{1,6}) (.*$)/gim, function(m, s, h) {return `</p><h${s.length} id="${h.toLowerCase().replace(/[^\w ]/g, "").replace(/ /g, "-")}">${h}</h${s.length}><p>`})
	.replace(/(^|\n)(.+)\n----\n/gi, '</p><h2>$2</h2><p>')
	.replace(/^---+$/gim, '</p><hr /><p>')

	// tabbed code
	.replace(/(^|\n)((( {4}|\t)[^\n]+\n)+)/g, function(m, nl, t) {
		return `</p><pre>${t
			.replace(/(^|\n)( {4}|\t)/g, (m,g) => {return g;})
			.replace(/\n/g, "<br>")
		}</pre><p>`;
	})
	
	//text alteration
	.replace(/__([^\n_]*)__/g, '<b>$1</b>')
	.replace(/_([^\n_]*)_/g, '<i>$1</i>')
	.replace(/``([^\n]+)``/g, '<c>$1</c>')
	.replace(/`([^\n`]+)`/g, '<c>$1</c>')
	.replace(/\*\*([^\n*]*)\*\*/g, '<b>$1</b>')
	.replace(/\*([^\n*]*)\*/g, '<i>$1</i>')
	.replace(/!\[(.*?)\]\((([^ )]*)( "([^")]+)"){0,1})\)/gim, "</p><img alt='$1' src='$3' title='$5'/><p>")
	.replace(/\[(.*?)\]\((([^ )]*)( "([^")]+)"){0,1})\)/gim, "<a href='$3' title='$5'>$1</a>")
	.replace(/  \n([^\n])/gi, '<br />$1')
	.replace(/\n\n+/gi, '</p><p>')
	.replace(/\n/gi, ' ')

	//markdown symbols

	//custom symbols
	.replace(/\&ast;/g, "*")
	;
	return (data);
}

module.exports = md;