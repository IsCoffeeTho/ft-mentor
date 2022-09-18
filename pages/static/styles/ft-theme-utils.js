class utils {
	static setup()
	{
		this.updateCheckables();
		this.updateRadios();
		this.updateDropdown();
	}

	static updateCheckables()
	{
		var buttons = document.getElementsByTagName("button");
		for (var button in buttons)
		{
			button = buttons[button];
			if (button.attributes)
				if (button.attributes['checkable'])
					button.onclick = this.checkableToggle;
		}
	}

	static updateRadios()
	{
		var radios = document.getElementsByTagName("radio");
		for (var radio in radios)
		{
			radio = radios[radio];
			if (radio.childNodes)
			{
				for (var option in radio.childNodes)
				{
					option = radio.childNodes[option];
					if (option.tagName == 'OPTION')
						radio.onclick = this.radioSelect;
				}
			}
		}
	}

	static updateDropdown()
	{
		var dropdowns = document.getElementsByTagName("dropdown");
		for (var dropdown in dropdowns)
		{
			dropdown = dropdowns[dropdown];
			if (dropdown.childNodes)
			{
				var button = undefined;
				var options = undefined;
				for (var element in dropdown.childNodes)
				{
					element = dropdown.childNodes[element];
					if (element.tagName == "BUTTON")
						button = element;
					else if (element.tagName == "OPTIONS")
						options = element;
				}
				if (button && options)
				{
					button.onclick = (e) => {
						if ((options.style.display || "none") == "none")
							options.style.display = "inline-flex";
						else
							options.style.display = "";
					};
					for (var option in options.childNodes)
					{
						option = options.childNodes[option];
						if (option.tagName == 'OPTION')
						{
							option.onclick = this.dropdownSelect;
						}
					}
				}
				else
					console.error("Invalid element", dropdown);
			}
		}
	}

	static checkableToggle(e)
	{
		var button = e.srcElement;
		if (button.attributes['checked'])
		{
			button.setAttribute('value', "false");
			button.removeAttribute('checked');
		}
		else
		{
			button.setAttribute('value', "true");
			button.setAttribute('checked', "");
		}
	}

	static radioSelect(e)
	{
		var currRadio = e.srcElement;
		var radio = currRadio.parentElement;
		if (radio.childNodes)
		{
			for (var option in radio.childNodes)
			{
				option = radio.childNodes[option];
				if (option.attributes)
					if (option.attributes['checked'])
						option.removeAttribute('checked');
			}
		}
		radio.setAttribute('value', currRadio.value);
		currRadio.setAttribute('checked', "");
	}

	static dropdownSelect(e)
	{
		var currOption = e.srcElement;
		var options = currOption.parentElement
		var dropdown = options.parentElement;
		if (options.childNodes)
		{
			for (var option in options.childNodes)
			{
				option = options.childNodes[option];
				if (option.attributes)
					if (option.attributes['checked'])
						option.removeAttribute('checked');
			}
		}
		dropdown.setAttribute('value', currOption.value);
		currOption.setAttribute('checked', "");
	}
}

document.fttu = utils;
document.onload = utils.setup();