THREE.ShaderChunk.map_fragment = [
    "#ifdef USE_MAP",
    "	vec4 texelColor = texture2D( map, vUv );",
//    "	texelColor.xyz = inputToLinear( texelColor.xyz );",
//	"	c = diffuseColor.rgb * diffuseColor.a + texelColor.rgb * texelColor.a * (1.0 - diffuseColor.a);",
//    "	diffuseColor = vec4(c, 1.0);",
//	"	texelColor += diffuseColor;",
    "	diffuseColor.rgb = texelColor.rgb;",
//    "	#ifdef ALPHATEST",
//    "		diffuseColor.a -= texelColor.a;",
//    "	#endif",
    "#endif",
].join('\n');
THREE.ShaderLib.phong.fragmentShader = [

	"#define PHONG",

	"uniform vec3 diffuse;",
	"uniform vec3 emissive;",
	"uniform vec3 specular;",
	"uniform float shininess;",
	"uniform float opacity;",

	THREE.ShaderChunk[ "common" ],
	THREE.ShaderChunk[ "color_pars_fragment" ],
	THREE.ShaderChunk[ "uv_pars_fragment" ],
	THREE.ShaderChunk[ "uv2_pars_fragment" ],
	THREE.ShaderChunk[ "map_pars_fragment" ],
	THREE.ShaderChunk[ "alphamap_pars_fragment" ],
	THREE.ShaderChunk[ "aomap_pars_fragment" ],
	THREE.ShaderChunk[ "lightmap_pars_fragment" ],
	THREE.ShaderChunk[ "emissivemap_pars_fragment" ],
	THREE.ShaderChunk[ "envmap_pars_fragment" ],
	THREE.ShaderChunk[ "fog_pars_fragment" ],
	THREE.ShaderChunk[ "lights_phong_pars_fragment" ],
	THREE.ShaderChunk[ "shadowmap_pars_fragment" ],
	THREE.ShaderChunk[ "bumpmap_pars_fragment" ],
	THREE.ShaderChunk[ "normalmap_pars_fragment" ],
	THREE.ShaderChunk[ "specularmap_pars_fragment" ],
	THREE.ShaderChunk[ "logdepthbuf_pars_fragment" ],

	"void main() {",

	"	vec3 outgoingLight = vec3( 0.0 );",
	"	vec4 diffuseColor = vec4( diffuse, opacity );",
	"	vec3 totalAmbientLight = ambientLightColor;",
	"	vec3 totalEmissiveLight = emissive;",
	"	vec3 shadowMask = vec3( 1.0 );",

		THREE.ShaderChunk[ "logdepthbuf_fragment" ],
		THREE.ShaderChunk[ "map_fragment" ],
		THREE.ShaderChunk[ "color_fragment" ],
		THREE.ShaderChunk[ "alphamap_fragment" ],
		THREE.ShaderChunk[ "alphatest_fragment" ],
		THREE.ShaderChunk[ "specularmap_fragment" ],
		THREE.ShaderChunk[ "normal_phong_fragment" ],
		THREE.ShaderChunk[ "lightmap_fragment" ],
		THREE.ShaderChunk[ "hemilight_fragment" ],
		THREE.ShaderChunk[ "aomap_fragment" ],
		THREE.ShaderChunk[ "emissivemap_fragment" ],

		THREE.ShaderChunk[ "lights_phong_fragment" ],
		THREE.ShaderChunk[ "shadowmap_fragment" ],

		"totalDiffuseLight *= shadowMask;",
		"totalSpecularLight *= shadowMask;",

		"#ifdef METAL",

		"	outgoingLight += diffuseColor.rgb * ( totalDiffuseLight + totalAmbientLight ) * specular + totalSpecularLight + totalEmissiveLight;",

		"#else",

		"	outgoingLight += diffuseColor.rgb * ( totalDiffuseLight + totalAmbientLight ) + totalSpecularLight + totalEmissiveLight;",

		"#endif",

		THREE.ShaderChunk[ "envmap_fragment" ],

		THREE.ShaderChunk[ "linear_to_gamma_fragment" ],

		THREE.ShaderChunk[ "fog_fragment" ],

	"	gl_FragColor = vec4( outgoingLight, diffuseColor.a );",

	"}"

].join( "\n" );

THREE.KN5Loader = function ( manager ) {
	
	this.manager = ( manager !== undefined ) ? manager : THREE.DefaultLoadingManager;
	
};

THREE.KN5Loader.prototype = {
	
	constructor: THREE.KN5Loader,
	
	ksDefault_vs: null,
	ksDefault_fs: null,
	
	progressValue: {
		lengthComputable: true,
		position		: 0,
		loaded			: 0,
		total			: 0,
		state			: null,
		message			: null
	},
	
	load: function ( url, onLoad, onProgress, onError ) {
		
		var scope = this;
		
		var loader = new THREE.XHRLoader( scope.manager );
		loader.setCrossOrigin( scope.crossOrigin );
		loader.setResponseType( "arraybuffer" );
		loader.load( url, function ( buffer ) {
			
			var ret = scope.parse( buffer, onProgress );
			
			onLoad( ret[0], ret[1] );
			
		}, onProgress, onError );
	},
	
	parse: function ( buffer, onProgress ) {
		
		var exportModel = new THREE.Group();
		var exportMaterial = [];
		
		var kn5Model = function() {
			this.materials	= [];
			this.nodes		= [];
			this.textures	= [];
			this.version	= null;
			this.extra		= null;
		};
		var kn5Texture = function() {
			this.active		= false;
			this.name		= "";
			this.size		= 0;
			this.data		= [];
		};
		var kn5Material = function() {
			this.name			= "Default";
			this.shader			= "";
			this.blendMode		= null;
			this.alphaTested	= false;
			this.depthMode		= null;
			this.property		= {};
			this.texture		= {};
		};
		var kn5Node = function() {
			this.active					= false;
			this.name					= "Default";
			this.parentID				= -1;
			this.materialID				= -1;
			this.castShadow				= false;
			this.isVisible				= false;
			this.isTransparent			= false;
			this.tmatrix				= [[1.0, 0.0, 0.0, 0.0], [0.0, 1.0, 0.0, 0.0], [0.0, 0.0, 1.0, 0.0], [0.0, 0.0, 0.0, 1.0]];
			this.hmatrix				= [[1.0, 0.0, 0.0, 0.0], [0.0, 1.0, 0.0, 0.0], [0.0, 0.0, 1.0, 0.0], [0.0, 0.0, 0.0, 1.0]];
			this.indices				= [];
			this.normal					= [];
			this.position				= [];
			this.rotation				= [0.0, 0.0, 0.0];
			this.scaling				= [1.0, 1.0, 1.0];
			this.texture				= [];
			this.translation			= [0.0, 0.0, 0.0];
			this.type					= 1;
			this.vertexCount			= 0;
			this.layer					= 0;
			this.lodIn					= 0;
			this.lodOut					= 0;
			this.boundingSphereCenter	= [0, 0, 0];
			this.boundingSphereRadius	= 0;
			this.isRenderable			= false;
		};

		var stream = new DataStream(buffer);
		
		if(stream.readString(6) != "sc6969")
		{
			console.log("ERROR: unknown file type.");
			return false;
		}
		
		var model = new kn5Model();
		model.version = stream.readInt32();
		
		if(model.version > 6)
		{
			console.log("ERROR: not supported version.");
			return false;
		}
		
		if(model.version > 5)
		{
			model.extra = stream.readInt32();
		}

		var textureLength = stream.readInt32();
		this.progressValue.total = textureLength;
		this.progressValue.loaded = 0;
		this.progressValue.state = "Textures analyzing";
		this.progressValue.message = null;
		if ( onProgress !== undefined ) {
			onProgress( this.progressValue );
		}
		for(var i = 0; i < textureLength; i++)
		{
			var texture		= new kn5Texture();
			texture.active	= stream.readInt32() == 1;
			texture.name	= stream.readString(stream.readInt32());
			texture.size	= stream.readInt32();
			
			if(texture.name in model.textures)
			{
				stream.position += texture.size;
			}
			else
			{
				var txt_buffer = new ArrayBuffer(texture.size);
				var txt_pos = 0;
				var txt_stream = new Int8Array(txt_buffer, txt_pos);
				for(var b = 0; b < texture.size; b++)
				{
					txt_stream[b] = stream.readInt8();
					txt_pos += txt_stream.BYTES_PER_ELEMENT;
				}
				
				var ext = texture.name.split('.');
				ext = ext[ext.length-1].toLowerCase();
				if(ext == "dds")
				{
					var dds = new THREE.DDSLoader();
					
					var images = [];
					var texture_ = new THREE.CompressedTexture();
					texture_.image = images;
					
					var texDatas = dds._parser( txt_buffer, true );
	
					if ( texDatas.isCubemap ) {
	
						var faces = texDatas.mipmaps.length / texDatas.mipmapCount;
	
						for ( var f = 0; f < faces; f ++ ) {
	
							images[ f ] = { mipmaps : [] };
	
							for ( var i = 0; i < texDatas.mipmapCount; i ++ ) {
	
								images[ f ].mipmaps.push( texDatas.mipmaps[ f * texDatas.mipmapCount + i ] );
								images[ f ].format = texDatas.format;
								images[ f ].width = texDatas.width;
								images[ f ].height = texDatas.height;
	
							}
	
						}
	
					} else {
	
						texture_.image.width = texDatas.width;
						texture_.image.height = texDatas.height;
						texture_.mipmaps = texDatas.mipmaps;
	
					}
	
					texture_.flipY = false;
					texture_.minFilter = texture_.magFilter = THREE.LinearFilter;
	
					texture_.format = texDatas.format;
					texture_.name = texture.name;
					
					texture_.needsUpdate = true;
					
					if( !texture_.format ) {
						console.warn('no support format: ' + texture_.name);
					}
					
					texture.data = texture_;
				}
				else
				{
					var binaryData = "";
					for (var b = 0; b < txt_buffer.byteLength; b++) {
						binaryData += String.fromCharCode(txt_buffer[i]);
					}
					var format = "";
					if (txt_buffer[0] === 0xff && txt_buffer[1] === 0xd8 && txt_buffer[bytes.byteLength-2] === 0xff && txt_buffer[txt_buffer.byteLength-1] === 0xd9) {
						format = "jpeg";
				    }
				    else if (txt_buffer[0] === 0x89 && txt_buffer[1] === 0x50 && txt_buffer[2] === 0x4e && txt_buffer[3] === 0x47) {
						format = "png";
				    }
				    else if (txt_buffer[0] === 0x47 && txt_buffer[1] === 0x49 && txt_buffer[2] === 0x46 && txt_buffer[3] === 0x38) {
						format = "gif";
				    }
				    else if (txt_buffer[0] === 0x42 && txt_buffer[1] === 0x4d) {
						format = "bmp";
				    }
				    else {
						format = "unknown";
					}
					
					texture.data = {format: format, binary: binaryData, image:{width: 0, height: 0}};
				}
				
				model.textures[texture.name] = texture;
			}
			this.progressValue.loaded++;
			this.progressValue.message = "Analyzed texture: " + texture.name;
			if ( onProgress !== undefined ) {
				onProgress( this.progressValue );
			}
		}

		var materialLength = stream.readInt32();
		this.progressValue.total = materialLength;
		this.progressValue.loaded = 0;
		this.progressValue.state = "Material analyzing";
		this.progressValue.message = null;
		if ( onProgress !== undefined ) {
			onProgress( this.progressValue );
		}
		
		function color(value) {
			return new THREE.Color(value, value, value);
		}
		for(var i = 0; i < materialLength; i++)
		{
			var material	= new kn5Material();
			material.name	= stream.readString(stream.readInt32());
			material.shader	= stream.readString(stream.readInt32());
			/*
			var params = {
				name			: material.name,
//				attributes		: {},
				uniforms		: {
									ksDiffuse		: { type: 'c', value: new THREE.Color(0, 0, 0) },
									ksAmbient		: { type: 'c', value: new THREE.Color(0, 0, 0) },
									ksSpecular		: { type: 'c', value: new THREE.Color(0, 0, 0) },
									ksSpecularEXP	: { type: 'f', value: 0 }
								},
				vertexShader	: ksDefault_vs.textContent,
				fragmentShader	: ksDefault_fs.textContent,
//				blending		: THREE.AdditiveBlending,
				transparent		: true,
//				depthTest		: false,
				side			: THREE.FrontSide
			};
			*/
			
			material.blendMode		= stream.readInt8();	//0:Opaque, 1:AlphaBlend, 2:AlphaToCoverage
			material.alphaTested	= stream.readInt8() == 1;
			if(model.version > 4) {
				material.depthMode	= stream.readInt32();	//0:Normal, 1:NoWrite, 2:Off
			}
			
			var propsLength = stream.readInt32();
			for(var p = 0; p < propsLength; p++)
			{
				var name = stream.readString(stream.readInt32());
				material.property[name] = {
					name	: name,
					valueA	: stream.readFloat32(),
					valueB	: [stream.readFloat32(), stream.readFloat32()],
					valueC	: [stream.readFloat32(), stream.readFloat32(), stream.readFloat32()],
					valueD	: [stream.readFloat32(), stream.readFloat32(), stream.readFloat32(), stream.readFloat32()],
				};
				/*
				switch(propName)
				{
					case 'ksDiffuse':
						// Diffuse color (color under white light) using RGB values
						//params.uniforms.ksDiffuse.value = new THREE.Color(propValue, propValue, propValue);
						params_.color = new THREE.Color(propValue, propValue, propValue);
						break;
					case 'ksAmbient':
						// Ambient color (color under shadow) using RGB values
						//params.uniforms.ksAmbient.value = new THREE.Color(propValue, propValue, propValue);
						break;
					case 'ksSpecular':
						// Specular color (color when light is reflected from shiny surface) using RGB values
						//params.uniforms.ksDiffuse.value = new THREE.Color(propValue, propValue, propValue);
						params_.specular = new THREE.Color(propValue, propValue, propValue);
						break;
					case 'ksSpecularEXP':
						// The specular exponent (defines the focus of the specular highlight)
						// A high exponent results in a tight, concentrated highlight. Ns values normally range from 0 to 1000.
						//params.uniforms.ksSpecularEXP.value = parseFloat(propValue*10);
						params_.shininess = parseFloat(propValue);
						break;
					
					default:
						break;
				}
				*/
			}
			
			var texturePropsLength = stream.readInt32();
			for(var p = 0; p < texturePropsLength; p++)
			{
				var name = stream.readString(stream.readInt32());
				material.texture[name] = {
					name	: name,
					slot	: stream.readInt32(),
					texture	: stream.readString(stream.readInt32())
				};
				
				/*
				if(model.textures[propValue].data)
				{
					params['uniforms'][propName] = {
						type	: 't',
						value	: model.textures[propValue].data
					};
				}
				*/
				
				//params_.transparent = true;
				/*
				switch(propName)
				{
					case 'txDiffuse':
						params_.map			= model.textures[propValue].data;
						params_.map.wrapS	= THREE.RepeatWrapping;
						params_.map.wrapT	= THREE.RepeatWrapping;
						params_.blending	= THREE.NormalBlending;
						break;
					
					case 'txDetail':
						params_.map			= model.textures[propValue].data;
						params_.map.wrapS	= THREE.RepeatWrapping;
						params_.map.wrapT	= THREE.RepeatWrapping;
						params_.blending	= THREE.NormalBlending;
						break;
					
					case 'txNormal':
						break;
						params_.bumpMap			= model.textures[propValue].data;
						params_.bumpMap.wrapS	= THREE.RepeatWrapping;
						params_.bumpMap.wrapT	= THREE.RepeatWrapping;
						params_.blending		= THREE.NormalBlending;
						break;
					
					default:
						break;
				}
				*/
			}
			
			//params_.transparent = true;

			/*
			
			//exportMaterial[material.name] = new THREE.ShaderMaterial( params );
			exportMaterial[material.name] = new THREE.MeshPhongMaterial( params_ );
			*/
			var params = {
				name			: material.name,
				side			: THREE.FrontSide,
				//alphaTest		: material.alphaTested,
				//blending		: (material.blendMode == 1 ? THREE.AdditiveBlending : THREE.NormalBlending),
				depthTest		: material.depthMode != 2,
				depthWrite		: material.depthMode == 0,
				transparent		: material.blendMode == 1 || material.alphaTested,
				color			: color(material.property.ksDiffuse.valueA),
				specular		: color(material.property.ksSpecular.valueA),
				shininess		: material.property.ksSpecularEXP.valueA,
				reflectivity	: material.property.ksSpecular.valueA / 10
			};
			//material_.blending = material.blendMode == 1 ? THREE.AdditiveAlphaBlending : THREE.NormalBlending;
			
			if(
				material.property.useDetail && material.property.useDetail.valueA == 1 &&
				material.texture.txDetail && model.textures[material.texture.txDetail.texture].data.image.width > 0
			)
			{
				params.map			= model.textures[material.texture.txDetail.texture].data;
				params.map.wrapS	= THREE.RepeatWrapping;
				params.map.wrapT	= THREE.RepeatWrapping;
			}
			else if(material.texture.txDiffuse && model.textures[material.texture.txDiffuse.texture].data.image.width > 0)
			{
				params.map			= model.textures[material.texture.txDiffuse.texture].data;
				params.map.wrapS	= THREE.RepeatWrapping;
				params.map.wrapT	= THREE.RepeatWrapping;
			}
			
			if(material.texture.txNormal && model.textures[material.texture.txNormal.texture].data.image.width > 0)
			{
				params.normalMap		= model.textures[material.texture.txNormal.texture].data;
				params.normalMap.wrapS	= THREE.RepeatWrapping;
				params.normalMap.wrapT	= THREE.RepeatWrapping;
			}
			
			if(params.map)
			{
				if(params.alphaTested)
				{
					params.transparent = true;
				}
			}
			
			var material_ = new THREE.MeshPhongMaterial( params );
			
			exportMaterial[material.name] = material_;

			model.materials.push(material);
			
			this.progressValue.loaded++;
			this.progressValue.message = "Analyzed Material: " + material.name;
			if ( onProgress !== undefined ) {
				onProgress( this.progressValue );
			}
		}
		
		var DEG2RAD = function (degree) {
		    return degree * (Math.PI / 180);
		}
		
		var RAD2DEG = function (radian) {
		    return radian / Math.PI * 180;
		}
		
		function MatrixToEuler(matrix)
		{
			var num1 = 0.0;
			var num2 = 0.0;
			var num3 = 0.0;
			
			if(matrix[0][1] > 0.998)
			{
				num1 = Math.atan2(-matrix[1][0], matrix[1][1]);
				num2 = DEG2RAD(-90);
				num3 = 0.0;
			}
			else if(matrix[0][1] < 0.998)
			{
				num1 = Math.atan2(-matrix[1][0], matrix[1][1]);
				num2 = DEG2RAD(90);
				num3 = 0.0;
			}
			else
			{
				num1 = Math.atan2(-matrix[0][1], matrix[0][0]);
				num2 = Math.atan2(-matrix[1][2], matrix[2][2]);
				num3 = Math.asin(matrix[0][2]);
			}
			num1 *= 180 / Math.PI;
			num2 *= 180 / Math.PI;
			num3 *= 180 / Math.PI;
			
			return [num3, num2, num1];
		}
		
		function ScaleFromMatrix(matrix)
		{
			var num1 = Math.sqrt(((matrix[0][0] * matrix[0][0]) + (matrix[1][0] * matrix[1][0])) + (matrix[2][0] * matrix[2][0]));
			var num2 = Math.sqrt(((matrix[0][1] * matrix[0][1]) + (matrix[1][1] * matrix[1][1])) + (matrix[2][1] * matrix[2][1]));
			var num3 = Math.sqrt(((matrix[0][2] * matrix[0][2]) + (matrix[1][2] * matrix[1][2])) + (matrix[2][2] * matrix[2][2]));
			
			return [num1, num2, num3];
		}
		
		function matrixMult(matrixA, matrixB)
		{
			var ret = new Array(4);
			for(var f = 0; f < 4; f++)
			{
				ret[f] = new Array(4);
				for(var s = 0; s < 4; s++)
				{
					ret[f][s] = (((matrixA[f][0] * matrixB[0][s]) + (matrixA[f][1] * matrixB[1][s])) + (matrixA[f][2] * matrixB[2][s])) + (matrixA[f][3] * matrixB[3][s]);
				}
			}
			return ret;
		}
		
		this.progressValue.total = stream.byteLength - stream.byteOffset;
		this.progressValue.loaded = 0;
		this.progressValue.position = 0;
		this.progressValue.state = "Mesh analyzing";
		this.progressValue.message = null;
		if ( onProgress !== undefined ) {
			onProgress( this.progressValue );
		}
		
		var pb = this.progressValue;
		
		model.nodes = readNodes(stream, model.nodes, -1);
		
		function readNodes(stream, nodeList, parentID)
		{
			var node		= new kn5Node();
			node.parentID	= parentID;
			node.type		= stream.readInt32();
			node.name		= stream.readString(stream.readInt32());
			
			var childLength = stream.readInt32();
			node.active		= stream.readInt8() == 1;
			
			switch(node.type)
			{
				case 1:
					for(var f = 0; f < 4; f++)
					{
						for(var s = 0; s < 4; s++)
						{
							node.tmatrix[f][s] = stream.readFloat32();
						}
					}
					node.translation	= [node.tmatrix[3][0], node.tmatrix[3][1], node.tmatrix[3][2]];
					node.rotation		= MatrixToEuler(node.tmatrix);
					node.scaling		= ScaleFromMatrix(node.tmatrix);
					break;
				
				case 2:
					node.castShadow		= stream.readInt8() == 1;
					node.isVisible		= stream.readInt8() == 1;
					node.isTransparent	= stream.readInt8() == 1;
					
					node.vertexCount = stream.readInt32();
					for(var i = 0; i < node.vertexCount; i++)
					{
						node.position[i] = [];
						node.position[i][0]	= stream.readFloat32();
						node.position[i][1]	= stream.readFloat32();
						node.position[i][2]	= stream.readFloat32();
						
						node.normal[i] = [];
						node.normal[i][0]	= stream.readFloat32();
						node.normal[i][1]	= stream.readFloat32();
						node.normal[i][2]	= stream.readFloat32();
						
						node.texture[i] = [];
						node.texture[i][0]	= stream.readFloat32();
						node.texture[i][1]	= stream.readFloat32();
						
						stream.position += (node.type == 2 ? 12 : 44)
					;
					}
					var indicesLength = stream.readInt32();
					for(var i = 0; i < indicesLength; i++)
					{
						node.indices[i] = stream.readUint16();
					}
					
					node.materialID	= stream.readInt32();
					node.layer		= stream.readInt32();
					node.lodIn		= stream.readFloat32();
					node.lodOut		= stream.readFloat32();
					node.boundingSphereCenter	= [stream.readFloat32(), stream.readFloat32(), stream.readFloat32()];
					node.boundingSphereRadius	= stream.readFloat32();
					node.isRenderable	= stream.readInt8() === 1;
					
					break;
				
				case 3:
					//SkinnedMesh
					break;
			}
			
			if(parentID < 0)
			{
				node.hmatrix = node.tmatrix;
			}
			else
			{
				node.hmatrix = matrixMult(node.tmatrix, nodeList[parentID].hmatrix);
			}
			
			nodeList.push(node);
			
			if(node.isRenderable)
			{
				var nodeGeometry = new THREE.Geometry();
				
				for(var i = 0; i < node.vertexCount; i++)
				{
					nodeGeometry.vertices.push( new THREE.Vector3(
						parseFloat((((node.hmatrix[0][0] * node.position[i][0]) + (node.hmatrix[1][0] * node.position[i][1])) + (node.hmatrix[2][0] * node.position[i][2])) + node.hmatrix[3][0]),
						parseFloat((((node.hmatrix[0][1] * node.position[i][0]) + (node.hmatrix[1][1] * node.position[i][1])) + (node.hmatrix[2][1] * node.position[i][2])) + node.hmatrix[3][1]),
						parseFloat((((node.hmatrix[0][2] * node.position[i][0]) + (node.hmatrix[1][2] * node.position[i][1])) + (node.hmatrix[2][2] * node.position[i][2])) + node.hmatrix[3][2])
					) );
				}
				
				var prop_ = model.materials[node.materialID].property;
				var diffuseMult = 1;
				if(node.materialID >= 0)
				{
					if(
						(prop_.useDetail && prop_.useDetail.valueA == 0) && prop_.diffuseMult)
					{
						diffuseMult = model.materials[node.materialID].property.diffuseMult.valueA;
					}
					else if(prop_.detailUVMultiplier)
					{
						diffuseMult = model.materials[node.materialID].property.detailUVMultiplier.valueA;
					}
				}
				
				var indicesCount = 0;
				for(var m = 0; m < (node.indices.length / 3); m++)
				{
					var ind1 = node.indices[m * 3] + indicesCount;
					var ind2 = node.indices[(m * 3) + 1] + indicesCount;
					var ind3 = node.indices[(m * 3) + 2] + indicesCount;
					function getNormal(matrix, normal)
					{
						return new THREE.Vector3(
							parseFloat(((matrix[0][0] * normal[0]) + (matrix[1][0] * normal[1])) + (matrix[2][0] * normal[2])),
							parseFloat(((matrix[0][1] * normal[0]) + (matrix[1][1] * normal[1])) + (matrix[2][1] * normal[2])),
							parseFloat(((matrix[0][2] * normal[0]) + (matrix[1][2] * normal[1])) + (matrix[2][2] * normal[2]))
						);
					}
					nodeGeometry.faces.push( new THREE.Face3( 
						parseInt( ind1 ),
						parseInt( ind2 ),
						parseInt( ind3 ),
						[
							getNormal(node.hmatrix, node.normal[ parseInt( ind1 ) ]),
							getNormal(node.hmatrix, node.normal[ parseInt( ind2 ) ]),
							getNormal(node.hmatrix, node.normal[ parseInt( ind3 ) ])
						]
					) );
					
					nodeGeometry.faceVertexUvs[ 0 ].push( [
						new THREE.Vector2(
							parseFloat( node.texture[ parseInt( ind1 ) ][0] * diffuseMult ),
							parseFloat( node.texture[ parseInt( ind1 ) ][1] * diffuseMult )
						),
						new THREE.Vector2(
							parseFloat( node.texture[ parseInt( ind2 ) ][0] * diffuseMult ),
							parseFloat( node.texture[ parseInt( ind2 ) ][1] * diffuseMult )
						),
						new THREE.Vector2(
							parseFloat( node.texture[ parseInt( ind3 ) ][0] * diffuseMult ),
							parseFloat( node.texture[ parseInt( ind3 ) ][1] * diffuseMult )
						)
					] );
				}
				indicesCount++;
				
				if ( node.vertexCount > 0 ) {
					nodeGeometry.mergeVertices();
					nodeGeometry.computeFaceNormals();
					nodeGeometry.computeBoundingSphere();
				}
				
				var nodeMaterial;
				if(node.materialID >= 0)
				{
					nodeMaterial = exportMaterial[model.materials[node.materialID].name];
				}
				else
				{
					nodeMaterial = new THREE.MeshPhongMaterial();
				}
				
				var nodeMesh = new THREE.Mesh( nodeGeometry, nodeMaterial );
				nodeMesh.name			= node.name;
				nodeMesh.castShadow		= node.castShadow;
				nodeMesh.receiveShadow	= true;
				
				exportModel.add(nodeMesh);
				
			}
			
			pb.loaded += stream.position - pb.position;
			pb.position = stream.position;
			pb.message = "Analyzed object: " + node.name;
			if ( onProgress !== undefined ) {
				onProgress( pb );
			}
			
			var index = nodeList.length - 1;
			for(var i = 0; i < childLength; i++)
			{
				nodeList = readNodes(stream, nodeList, index);
			}
			
			return nodeList;
		}
		
		this.progressValue.state = "parse complete";
		this.progressValue.message = null;
		if ( onProgress !== undefined ) {
			onProgress( this.progressValue );
		}
		console.log(model);
		return [exportModel, model.textures];
	}
}

THREE.EventDispatcher.prototype.apply( THREE.KN5Loader.prototype );
