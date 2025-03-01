/**
 * Handle Section Library.
 */

/**
 * Globals.
 */
const {
	localStorage,
} = window;

/**
 * WordPress dependencies
 */
const {
	applyFilters,
} = wp.hooks;

import {
	withSelect,
	useSelect,
	withDispatch,
	useDispatch,
} from '@wordpress/data';
/**
 * WordPress dependencies
 */
import { parse, rawHandler } from '@wordpress/blocks';
import { debounce, isEqual } from 'lodash';
import {
	Button,
	TextControl,
	SearchControl,
	TextareaControl,
	SelectControl,
	Popover,
	ToggleControl,
	VisuallyHidden,
	ExternalLink,
	Spinner,
	Icon
} from '@wordpress/components';
import {
	arrowLeft,
	download,
	previous,
	update,
	next,
	edit,
	chevronLeft,
	chevronDown,
	settings,
	image,
	chevronRightSmall,
} from '@wordpress/icons';
import { __, sprintf } from '@wordpress/i18n';
import { store as noticesStore } from '@wordpress/notices';
import PatternList from './pattern-list';
import PageList from './page-list';
import { useMemo, useEffect, useState } from '@wordpress/element';
import {
	store as blockEditorStore,
} from '@wordpress/block-editor';
import { getAsyncData } from './data-fetch/get-async-data';
/**
 * Internal dependencies
 */
import { SafeParseJSON } from '@kadence/helpers';

import { kadenceNewIcon, aiIcon, aiSettings, eye } from '@kadence/icons';
import { AiWizard } from './ai-wizard';
import { PAGE_CATEGORIES, PATTERN_CONTEXTS, PATTERN_CATEGORIES, CONTEXTS_STATES, CONTEXT_PROMPTS } from './data-fetch/constants';
import { sendEvent } from '../../extension/analytics/send-event';

// @todo: Get page style terms dynamically.
const styleTerms = ['Typographic', 'Image Heavy', 'Content Dense', 'Minimalist'];

/**
 * Prebuilt Sections.
 */
function PatternLibrary( {
	importContent,
	clientId,
	reload = false,
	onReload,
 } ) {
	const isAIDisabled	   = window?.kadence_blocks_params?.isAIDisabled ? true : false;
	const [ category, setCategory ] = useState( '' );
	const [ pageCategory, setPageCategory ] = useState( '' );
	const [ pageStyles, setPageStyles ] = useState( styleTerms );
	const [ search, setSearch ] = useState( null );
	const [ subTab, setSubTab ] = useState( '' );
	const [ patterns, setPatterns ] = useState( false );
	const [ pages, setPages ] = useState( false );
	const [ aiContent, setAIContent ] = useState( {} );
	const [ context, setContext ] = useState( '' );
	const [ credits, setCredits ] = useState( '' );
	const [ contextTab, setContextTab ] = useState( '' );
	const [ aIUserData, setAIUserData ] = useState( false );
	const [ localContexts, setLocalContexts ] = useState( false );
	const [ imageCollection, setImageCollection ] = useState( {} );
	const [ teamCollection, setTeamCollection ] = useState( {} );
	const [ categories, setCategories ] = useState( PATTERN_CATEGORIES );
	const [ categoryListOptions, setCategoryListOptions ] = useState( [] );
	const [ styleListOptions, setStyleListOptions ] = useState( [] );
	const [ contextOptions, setContextOptions ] = useState( PATTERN_CONTEXTS );
	const [ contextStatesRef, setContextStatesRef ] = useState( false );
	const [ contextListOptions, setContextListOptions ] = useState( [] );
	const [ pagesCategories, setPagesCategories ] = useState( PAGE_CATEGORIES );
	const [ pageCategoryListOptions, setPageCategoryListOptions ] = useState( [] );
	const [ pageContextListOptions, setPageContextListOptions ] = useState( [] );
	const [ previewMode, setPreviewMode ] = useState();
	const [ isLoading, setIsLoading ] = useState( false );
	const [ isImporting, setIsImporting ] = useState( false );
	const [ hasInitialAI, setHasInitialAI ] = useState( false );
	const [ aINeedsData, setAINeedsData ] = useState( false );
	const [ wizardState, setWizardState ] = useState( {
		visible: false,
		photographyOnly: false
	} );
	const [ isError, setIsError ] = useState( false );
	const [ isErrorType, setIsErrorType ] = useState( 'general' );
	const [ style, setStyle ] = useState( '' );
	const [ replaceImages, setReplaceImages ] = useState( '' );
	const [ fontSize, setFontSize ] = useState( '' );
	const [ aiDataState, triggerAIDataReload ] = useState( false );
	const [ isVisible, setIsVisible ] = useState( false );
	const [ isAdvVisible, setIsAdvVisible ] = useState( false );
	const [ isFilterVisible, setIsFilterVisible ] = useState( false );
	const [ filterChoices, setFilterChoices ] = useState(
		new Array( styleTerms.length ).fill( false )
	);
	const [ isContextReloadVisible, setIsContextReloadVisible ] = useState( false );
	const [ popoverContextAnchor, setPopoverContextAnchor ] = useState();
	const [ popoverAnchor, setPopoverAnchor ] = useState();
	const [ popoverAdvAnchor, setPopoverAdvAnchor ] = useState();
	const [ filterPopoverAnchor, setFilterPopoverAnchor ] = useState();
	const { updateContextState, updateMassContextState, updateContext, updateMassContext } = useDispatch( 'kadence/library' );
	const { getContextState, isContextRunning, getContextContent, hasContextContent } = useSelect(
		( select ) => {
			return {
				getContextState: ( value ) => select( 'kadence/library' ).getContextState( value ),
				isContextRunning: ( value ) => select( 'kadence/library' ).isContextRunning( value ),
				getContextContent: ( value ) => select( 'kadence/library' ).getContextContent( value ),
				hasContextContent: ( value ) => select( 'kadence/library' ).hasContextContent( value ),
			};
		},
		[]
	);
	const toggleVisible = () => {
		setIsVisible( ( state ) => ! state );
	};
	const toggleAdvVisible = () => {
		setIsAdvVisible( ( state ) => ! state );
	};
	const toggleFilterVisible = () => {
		setIsFilterVisible( ( state ) => ! state );
	};
	const handleFilterToggle = ( position ) => {
		const updatedChoices = filterChoices.map((item, index) => (
			index === position ? !item : item
		));
		setFilterChoices(updatedChoices);
	};
	const toggleReloadVisible = () => {
		setIsContextReloadVisible( ( state ) => ! state );
	};
	const closeAiWizard = () => {
		setWizardState( {
			visible: false,
			photographyOnly: false
		} );

		triggerAIDataReload( ( state ) => ! state );
	};
	const handleAiWizardPrimaryAction = ( event, rebuild ) => {

		if ( rebuild ) {
			getAllNewData();
		}
	}
	const hasCorrectUserData = ( tempData ) => {
		const parsedUserData = SafeParseJSON( tempData, true );
		if ( ! parsedUserData ) {
			return false;
		}
		// Check for CompanyName, Location, Industry, MissionStatement, Keywords.
		if ( ! parsedUserData?.companyName || '' === parsedUserData?.companyName ) {
			return false;
		}
		if ( ! parsedUserData?.location || '' === parsedUserData?.location ) {
			return false;
		}
		if ( ! parsedUserData?.industry || '' === parsedUserData?.industry ) {
			return false;
		}
		if ( ! parsedUserData?.missionStatement || '' === parsedUserData?.missionStatement ) {
			return false;
		}
		if ( ! parsedUserData?.keywords?.length || parsedUserData?.keywords?.length < 5 ) {
			return false;
		}
		if ( ! parsedUserData?.tone || '' === parsedUserData?.tone ) {
			return false;
		}
		return true;
	}
	const isAuthorized = window?.kadence_blocks_params?.isAuthorized;
	const activateLink = ( window?.kadence_blocks_params?.homeLink ? kadence_blocks_params.homeLink : '' );
	const activeStorage = SafeParseJSON( localStorage.getItem( 'kadenceBlocksPrebuilt' ), true );
	const savedStyle = ( undefined !== activeStorage?.style && '' !== activeStorage?.style ? activeStorage.style : 'light' );
	const savedTab = ( undefined !== activeStorage?.subTab && '' !== activeStorage?.subTab ? activeStorage.subTab : 'patterns' );
	const savedSelectedCategory = ( undefined !== activeStorage?.kbCat && '' !== activeStorage?.kbCat ? activeStorage.kbCat : 'all' );
	const savedSelectedPageCategory = ( undefined !== activeStorage?.kbPageCat && '' !== activeStorage?.kbPageCat ? activeStorage.kbPageCat : 'home' );
	const savedSelectedPageStyles = ( undefined !== activeStorage?.kbPageStyles && '' !== activeStorage?.kbPageStyles ? activeStorage.kbPageStyles : 'all' ); // @todo: Should probably be an array of all available styles
	const savedPreviewMode = ( undefined !== activeStorage?.previewMode && '' !== activeStorage?.previewMode ? activeStorage.previewMode : 'iframe' );
	const savedReplaceImages = ( undefined !== activeStorage?.replaceImages && '' !== activeStorage?.replaceImages ? activeStorage.replaceImages : 'all' );
	const savedFontSize = ( undefined !== activeStorage?.fontSize && '' !== activeStorage?.fontSize ? activeStorage.fontSize : 'lg' );
	const savedContextTab = ( undefined !== activeStorage?.contextTab && '' !== activeStorage?.contextTab ? activeStorage.contextTab : 'design' );
	const savedContext = ( undefined !== activeStorage?.context && '' !== activeStorage?.context ? activeStorage.context : 'value-prop' );
	const savedCredits = ( undefined !== activeStorage?.credits && '' !== activeStorage?.credits && null !== activeStorage?.credits ? activeStorage.credits : 'fetch' );
	const currentCredits = ( '' !== credits ? credits : savedCredits );
	const selectedCategory = ( category ? category : savedSelectedCategory );
	const selectedPageCategory = ( pageCategory ? pageCategory : savedSelectedPageCategory );
	const selectedPageStyles = ( pageStyles ? pageStyles : savedSelectedPageStyles );
	const selectedPreviewMode = ( previewMode ? previewMode : savedPreviewMode );
	const selectedStyle = ( style ? style : savedStyle );
	const selectedReplaceImages = ( replaceImages ? replaceImages : savedReplaceImages );
	const selectedFontSize = ( fontSize ? fontSize : savedFontSize );
	const selectedSubTab = ( subTab ? subTab : savedTab );
	const selectedContextTab = ( contextTab ? contextTab : savedContextTab );
	const selectedContext = ( context ? context : savedContext );
	const selectedContextLabel = contextOptions?.[selectedContext];
	const { createErrorNotice } = useDispatch(
		noticesStore
	);

	// Setting category options
	useEffect( () => {
		setCategoryListOptions( Object.keys( categories ).map( function( key, index ) {
			return { value: ( 'category' === key ? 'all' : key ), label: ( 'category' === key ? __( 'All', 'kadence-blocks' ) : categories[key] ) }
		} ) );
	}, [ categories ] );

	// Setting style options
	useEffect( () => {
		const patternStyles = Object.keys( patterns ).map( function( key ) {
			return patterns[ key ].styles;
		} );

		// If array is empty, return
		if ( ! patternStyles.length ) {
			return;
		}

		// Clear duplicates
		const uniqueMap = new Map();
		patternStyles.forEach( ( item ) => {
			if ( ! item ) {
				return;
			}
			const key = Object.keys( item )[ 0 ];
			const value = item[ key ];
			uniqueMap.set( value, item );
		} );

		const uniqueArray = Array.from( uniqueMap.values() );
		const styleOptions = uniqueArray.map( function( key ) {
			const keyValue = Object.keys( key )[ 0 ];
			const keyName = key[ keyValue ];
			return { value: keyValue, label: keyName };
		} );

		setStyleListOptions( styleOptions );
	}, [ patterns ] );

	useEffect( () => {
		setPageCategoryListOptions( Object.keys( pagesCategories ).map( function( key, index ) {
			return { value: ( 'category' === key ? 'all' : key ), label: ( 'category' === key ? __( 'All', 'kadence-blocks' ) : pagesCategories[key] ) }
		} ) );
		let tempPageContexts = [];
		Object.keys( pagesCategories ).map( function( key, index ) {
			if ( 'category' !== key ) {
				tempPageContexts.push( { value: ( 'category' === key ? 'all' : key ), label: ( 'category' === key ? __( 'All', 'kadence-blocks' ) : pagesCategories[key] ) } );
			}
		} );
		setPageContextListOptions( tempPageContexts );
	}, [ pagesCategories ] );
	useEffect( () => {
		setContextListOptions( Object.keys( contextOptions ).map( function( key, index ) {
			return { value: key, label: contextOptions[key] }
		} ) );
	}, [] );
	useEffect(() => {
		const activePageStyles = styleTerms.filter((style, index) => filterChoices[index] && style);
		const tempActiveStorage = SafeParseJSON( localStorage.getItem( 'kadenceBlocksPrebuilt' ), true );
		tempActiveStorage['kbPageStyles'] = activePageStyles;
		localStorage.setItem( 'kadenceBlocksPrebuilt', JSON.stringify( tempActiveStorage ) );

		setPageStyles( activePageStyles );
	}, [ filterChoices ])
	const { getAIContentData, getAIContentDataReload, getAIWizardData, getCollectionByIndustry, getPatterns, getPattern, processPattern, getLocalAIContexts, getLocalAIContentData, getAIContentRemaining, getInitialAIContent, getAvailableCredits } = getAsyncData();
	async function getLibraryContent( tempSubTab, tempReload ) {
		setIsLoading( true );
		setIsError( false );
		setIsErrorType( 'general' );
		const response = await getPatterns( ( tempSubTab === 'pages' ? 'pages' : 'section' ), tempReload );
		if ( response === 'failed' ) {
			console.log( 'Permissions Error getting library Content' );
			if ( tempSubTab === 'pages' ) {
				setPages( 'error' );
			} else {
				setPatterns( 'error' );
			}
			setIsError( true );
			setIsErrorType( 'reload' );
			setIsLoading( false );
		} else if ( response === 'error' ) {
			console.log( 'Error getting library Content.' );
			if ( tempSubTab === 'pages' ) {
				setPages( 'error' );
			} else {
				setPatterns( 'error' );
			}
			setIsError( true );
			setIsLoading( false );
		} else {
			const o = SafeParseJSON( response, false );
			if ( o ) {
				if ( tempSubTab === 'pages' ) {
					const pageCats = PAGE_CATEGORIES;
					kadence_blocks_params.library_pages = o;
					{ Object.keys( o ).map( function( key, index ) {
						if ( o[ key ].categories && typeof o[ key ].categories === "object") {
							{ Object.keys( o[ key ].categories ).map( function( ckey, i ) {
								if ( ! pageCats.hasOwnProperty( ckey ) ) {
									pageCats[ ckey ] = o[ key ].categories[ ckey ];
								}
							} ) }
						}
					} ) }
					setPages( o );
					setPagesCategories( JSON.parse(JSON.stringify( pageCats ) ) );
				} else {
					const cats = PATTERN_CATEGORIES;
					kadence_blocks_params.library_sections = o;
					{ Object.keys( o ).map( function( key, index ) {
						if ( o[ key ].categories && typeof o[ key ].categories === "object") {
							{ Object.keys( o[ key ].categories ).map( function( ckey, i ) {
								if ( ! cats.hasOwnProperty( ckey ) ) {
									cats[ ckey ] = o[ key ].categories[ ckey ];
								}
							} ) }
						}
					} ) }
					setPatterns( o );
					setCategories( JSON.parse(JSON.stringify( cats ) ) );
				}
			} else {
				if ( tempSubTab === 'pages' ) {
					setPages( 'error' );
				} else {
					setPatterns( 'error' );
				}
				setIsError( true );
			}
			setIsLoading( false );
		}
	}
	useEffect( () => {
		if ( reload && ! isLoading ) {
			onReload();
			getLibraryContent( selectedSubTab, true );
		} else if ( ! isLoading ) {
			getLibraryContent( selectedSubTab, false );
		}
	}, [reload, selectedSubTab] );
	const forceRefreshLibrary = () => {
		if ( ! isLoading && patterns ) {
			setPatterns( JSON.parse(JSON.stringify(patterns)) );
		}
		if ( ! isLoading && pages ) {
			setPages( JSON.parse(JSON.stringify(pages)) );
		}
	}
	async function getAIContent( tempContext, checking = false ) {
		if ( ! checking ) {
			if ( 'loading' !== getContextState( tempContext ) ) {
				updateContextState( tempContext, 'loading' );
			}
		}
		const response = await getAIContentData( tempContext );
		if ( response === 'processing' ) {
			console.log( 'Is processing AI' );
			if ( 'processing' !== getContextState( tempContext ) ) {
				updateContextState( tempContext, 'processing' );
			}
			setTimeout( () => {
				getAIContent( tempContext, true );
			}, 1000 );
		} else if ( response === 'Failed' ) {
			console.log( 'Permissions Error getting AI Content.' );
			updateContext( tempContext, 'failedReload' );
			setTimeout( () => {
				forceRefreshLibrary();
			}, 500 );
			updateContextState( tempContext, false );
		} else if ( response === 'error' ) {
			console.log( 'Error getting AI Content.' );
			createErrorNotice( __('Error generating AI content, Please Retry'), { type: 'snackbar' } );
			updateContext( tempContext, 'failed' );
			setTimeout( () => {
				forceRefreshLibrary();
			}, 500 );
			updateContextState( tempContext, false );
		} else {
			const o = SafeParseJSON( response, false );
			let tempLocalContexts = [];
			if ( false !== localContexts ) {
				tempLocalContexts = localContexts;
			}
			if ( ! tempLocalContexts.includes( tempContext ) ) {
				tempLocalContexts.push( tempContext );
				setLocalContexts( tempLocalContexts );
			}
			updateContext( tempContext, o );
			setTimeout( () => {
				forceRefreshLibrary();
			}, 500 );
			updateContextState( tempContext, true );
		}
	}
	async function reloadAI( tempContext ) {
		updateContextState( tempContext, 'processing' );
		let tempLocalContexts = [];
		if ( false !== localContexts ) {
			tempLocalContexts = localContexts;
		}
		if ( ! tempLocalContexts.includes( tempContext ) ) {
			tempLocalContexts.push( tempContext );
			setLocalContexts( tempLocalContexts );
		}
		const response = await getAIContentDataReload( tempContext );
		console.log( response );
		if ( response === 'processing' ) {
			console.log( 'Is processing AI' );
			setTimeout( () => {
				getAIContent( tempContext, true );
			}, 1000 );
			getRemoteAvailableCredits();
		} else if ( response === 'credits' ) {
			console.log( 'Error not enough credits to reload.' );
			updateContextState( tempContext, 'credits' );
			setTimeout( () => {
				forceRefreshLibrary();
			}, 500 );
			getRemoteAvailableCredits();
		} else {
			console.log( 'Error getting New AI Job.' );
			// updateContext( tempContext, 'failed' );
			updateContextState( tempContext, 'error' );
			setTimeout( () => {
				forceRefreshLibrary();
			}, 500 );
			getRemoteAvailableCredits();
		}
	}

	useEffect( () => {
		if ( hasInitialAI ) {
			if ( hasContextContent( selectedContext ) ) {
				forceRefreshLibrary();
			} else if ( localContexts && localContexts.includes( selectedContext ) ) {
				getAIContent( selectedContext );
			} else {
				forceRefreshLibrary();
			}
		}
	}, [selectedContext, hasInitialAI] );
	async function getAIUserData() {
		const response = await getAIWizardData();
		if ( ! response ) {
			setAINeedsData( true );
		} else if ( ! hasCorrectUserData( response ) ) {
			const data = response ? SafeParseJSON(response) : {};
			if ( data?.photoLibrary && data?.customCollections ) {
				getJustImageCollection( data );
			}
			console.log( 'User Data is not correct' );
			setAINeedsData( true );
		} else {
			const data = response ? SafeParseJSON(response) : {};
			setAIUserData(data);
			setAINeedsData( false );
		}
	}
	async function getAllNewData() {
		setIsLoading( true );
		const response = await getInitialAIContent( true );
		//console.log( response );
		if ( response === 'error' || response === 'failed' ) {
			createErrorNotice( __('Error generating AI content, Please Retry'), { type: 'snackbar' } );
			console.log( 'Error getting AI Content.' );
			setIsLoading( false );
		} else if ( response?.error && response?.context ) {
			createErrorNotice( __('Error, Some AI Contexts could not be started, Please Retry'), { type: 'snackbar' } );
			console.log( 'Error getting all new AI Content.' );
			const tempContextStates = [];
			response?.context.forEach( key => {
				tempContextStates.push(key);
			});
			updateMassContextState( tempContextStates, 'processing' );
			response?.context.forEach( ( key, index ) => {
				setTimeout( () => {
					getAIContent( key, true );
				}, 1000 + ( index * 50 ) );
			});
			setIsLoading( false );
		} else {
			const tempContextStates = [];
			response.forEach( key => {
				tempContextStates.push(key);
			});
			updateMassContextState( tempContextStates, 'processing' );
			response.forEach( ( key, index ) => {
				setTimeout( () => {
					getAIContent( key, true );
				}, 1000 + ( index * 50 ) );
			});
			getRemoteAvailableCredits();
			setIsLoading( false );
		}
	}
	/**
	 * @returns {Promise<void>}
	 */
	async function getJustImageCollection( tempUserData ) {
		const tempUser = JSON.parse(JSON.stringify( tempUserData ) );
		tempUser.photoLibrary = 'Other';
		const teamResponse = await getCollectionByIndustry( tempUser );
		if ( ! isEqual( teamResponse, teamCollection ) ) {
			console.log( 'Image Team Collection Updating' );
			setTeamCollection(teamResponse);
		}
		const response = await getCollectionByIndustry( tempUserData );
		if ( ! isEqual( response, imageCollection ) ) {
			console.log( 'Image Collection Updating' );
			setImageCollection(response);
			forceRefreshLibrary();
		}
	}
	/**
	 * @returns {Promise<void>}
	 */
	async function getImageCollection() {
		const tempUser = JSON.parse(JSON.stringify( aIUserData ) );
		tempUser.photoLibrary = 'Other';
		const teamResponse = await getCollectionByIndustry( tempUser );
		if ( ! isEqual( teamResponse, teamCollection ) ) {
			console.log( 'Image Team Collection Updating' );
			setTeamCollection(teamResponse);
		}
		const response = await getCollectionByIndustry( aIUserData );
		if ( ! isEqual( response, imageCollection ) ) {
			console.log( 'Image Collection Updating' );
			setImageCollection(response);
			forceRefreshLibrary();
		}
	}
	async function getAILocalData() {
		const localContent = await getLocalAIContentData();
		const localPrompts = await getLocalAIContexts();
		const tempContextStates = [];
		let hasLocalContent = false;
		if ( 'empty' === localContent ) {
			console.log( 'No Local AI Content' );
			setHasInitialAI( true );
		} else if ( 'failed' === localContent ) {
			console.log( 'Failed to load Local' );
			setHasInitialAI( true );
		} else {
			hasLocalContent = true;
			Object.keys( localContent ).forEach( key => {
				if ( localContent?.[key]?.content?.length > 0 ) {
					tempContextStates.push(key);
				}
			});
			if ( tempContextStates.length > 0 ) {
				updateMassContext( tempContextStates, localContent )
				updateMassContextState( tempContextStates, true );
			}
			forceRefreshLibrary();
			setHasInitialAI( true );
		}
		if ( 'failed' === localPrompts ) {
			console.log( 'No Local Prompts' );
		} else if ( localPrompts && localPrompts.length > 0 && hasLocalContent ) {
			localPrompts.forEach( key => {
				if ( tempContextStates.indexOf( key ) === -1 ) {
					getAIContent( key, true );
				}
			});
			setLocalContexts( localPrompts );
		}
	}
	async function getRemoteAvailableCredits() {
		const response = await getAvailableCredits();
		const tempActiveStorage = SafeParseJSON( localStorage.getItem( 'kadenceBlocksPrebuilt' ), true );
		if ( response === 'error' ) {
			console.log( 'Error getting credits' );
			tempActiveStorage['credits'] = 'fetch';
			localStorage.setItem( 'kadenceBlocksPrebuilt', JSON.stringify( tempActiveStorage ) );
			setCredits(0);
		} else if ( response === '' ) {
			tempActiveStorage['credits'] = 0;
			localStorage.setItem( 'kadenceBlocksPrebuilt', JSON.stringify( tempActiveStorage ) );
			setCredits( 0 );
		} else {
			tempActiveStorage['credits'] = parseInt( response );
			localStorage.setItem( 'kadenceBlocksPrebuilt', JSON.stringify( tempActiveStorage ) );
			setCredits( parseInt( response ) );
		}
	}
	useEffect(() => {
		getAIUserData();
		if ( isAuthorized && currentCredits === 'fetch' ) {
			getRemoteAvailableCredits();
		}
	}, [aiDataState]);
	useEffect(() => {
		if ( isAuthorized && aIUserData && ! hasInitialAI ) {
			getAILocalData();
		}
	}, [aIUserData]);
	useEffect(() => {
		if ( aIUserData ) {
			getImageCollection();
		}
	}, [aIUserData]);
	async function onInsertContent( pattern ) {
		setIsImporting( true );
		const response = await getPattern( ( pattern?.type === 'page' ? 'pages' : 'section' ), ( pattern?.type ? pattern.type : 'pattern' ), ( pattern?.id ? pattern.id : '' ), ( pattern?.style ? pattern.style : 'light' ) );
		let patternBlocks = pattern?.content ? pattern.content : '';
		if ( response && ! patternBlocks ) {
			patternBlocks = parse( response, {
				__unstableSkipMigrationLogs: true
			});
		}
		processImportContent( patternBlocks );
	}
	const ajaxImportProcess = ( blockcode ) => {
		var data = new FormData();
		data.append( 'action', 'kadence_import_process_image_data' );
		data.append( 'security', kadence_blocks_params.ajax_nonce );
		data.append( 'import_content', blockcode );
		data.append( 'image_library', JSON.stringify( imageCollection ) );
		jQuery.ajax( {
			method:      'POST',
			url:         kadence_blocks_params.ajax_url,
			data:        data,
			contentType: false,
			processData: false,
		} )
		.done( function( response, status, stately ) {
			if ( response ) {
				importContent( response, clientId );
			} else {
				setIsError( true );
				setIsErrorType( 'reload' );
			}
			setIsImporting( false );
		})
		.fail( function( error ) {
			console.log( error );
			setIsError( true );
			setIsErrorType( 'reload' );
			setIsImporting( false );
		});
	}
	async function processImportContent( blockCode ) {
		const response = await processPattern( blockCode, imageCollection );
		if ( response === 'failed' ) {
			// It could fail because cloudflare is blocking the request. Lets try with ajax.
			ajaxImportProcess( blockCode, imageCollection );
			console.log( 'Import Process Failed when processing data through rest api... Trying ajax.' );
		} else {
			importContent( response, clientId );
			setIsImporting( false );
		}
	}
	const styleOptions = [
		{ value: 'light', label: __( 'Light', 'kadence-blocks' ) },
		{ value: 'dark', label: __( 'Dark', 'kadence-blocks' ) },
		{ value: 'highlight', label: __( 'Highlight', 'kadence-blocks' ) }
	];
	const pageStyleOptions = [
		{ value: 'light', label: __( 'Light', 'kadence-blocks' ) },
		{ value: 'dark', label: __( 'Dark', 'kadence-blocks' ) },
	];
	const sizeOptions = [
		{ value: 'sm', label: __( 'Smaller', 'kadence-blocks' ) },
		{ value: 'lg', label: __( 'Normal', 'kadence-blocks' ) }
	];
	const breakpointColumnsObj = {
		default: 3,
		1900: 3,
		1600: 3,
		1200: 2,
		500: 1,
	};
	return (
		<div className={ `kt-prebuilt-content kb-prebuilt-has-sidebar` }>
			<div className="kt-prebuilt-sidebar kb-section-sidebar">
				<div className='kb-prebuilt-sidebar-header-wrap'>
					<div className="kb-prebuilt-sidebar-header kb-prebuilt-library-logo">
						<span className="kb-prebuilt-header-logo">{ kadenceNewIcon }</span>
						<div className="kb-library-style-popover">
							<Button
								className={ 'kb-trigger-extra-settings' }
								icon={ aiSettings }
								ref={ setPopoverAnchor }
								isPressed={ isVisible }
								disabled={ isVisible }
								onClick={ toggleVisible }
							/>
							{ isVisible && (
								<Popover
									className="kb-library-extra-settings"
									placement="top-end"
									onClose={ debounce( toggleVisible, 100 ) }
									anchor={ popoverAnchor }
								>
									{ ! isAIDisabled && isAuthorized && (
										<Button
											className='kadence-ai-wizard-button'
											iconPosition='left'
											icon={ aiIcon }
											text={ __('Update Kadence AI Details', 'kadence-blocks') }
											onClick={ () => {
												setIsVisible( false );
												getRemoteAvailableCredits();
												setWizardState( {
													visible: true,
													photographyOnly: false
												} );
											}}
										/>
 									) }
									{ ! isAIDisabled && ! isAuthorized && (
										<Button
											className='kadence-ai-wizard-button'
											iconPosition='left'
											icon={ aiIcon }
											text={ __('Activate Kadence AI', 'kadence-blocks') }
											disabled={ activateLink ? false : true }
											target={ activateLink ? '_blank' : ''}
											href={ activateLink ? activateLink : '' }
										/>
 									) }
									<Button
										icon={ image }
										iconPosition='left'
										className='kadence-ai-wizard-button'
										text={ __('Update Design Library Images', 'kadence-blocks') }
										disabled={ selectedReplaceImages === 'none' }
										onClick={ () => {
											setIsVisible( false );
											setWizardState( {
												visible: true,
												photographyOnly: true
											} );
										}}
									/>
									<Button
										iconPosition='left'
										className='kadence-ai-wizard-button'
										icon={ eye }
										ref={ setPopoverAdvAnchor }
										isPressed={ isAdvVisible }
										disabled={ isAdvVisible }
										onClick={ toggleAdvVisible }
									><span className='kb-wizard-advanced-text'>{__('Advanced', 'kadence-blocks') }</span> <span className='kb-carrot-open'><Icon icon={ chevronRightSmall } /></span></Button>
									{ isAdvVisible && (
										<Popover
											className="kb-library-extra-advanced-settings"
											placement="right-start"
											onClose={ debounce( toggleAdvVisible, 100 ) }
											anchor={ popoverAdvAnchor }
										>
											<ToggleControl
												className='kb-toggle-align-right small'
												label={__( 'Custom Image Selection', 'kadence-blocks' )}
												checked={selectedReplaceImages !== 'none'}
												help={__('If disabled you will import and preview only wireframe images.', 'kadence-blocks')}
												onChange={( value ) => {
													const tempActiveStorage = SafeParseJSON( localStorage.getItem( 'kadenceBlocksPrebuilt' ), true );
													tempActiveStorage['replaceImages'] = ( value ? 'all' : 'none' );
													localStorage.setItem( 'kadenceBlocksPrebuilt', JSON.stringify( tempActiveStorage ) );
													setPatterns( JSON.parse(JSON.stringify(patterns)) );
													setReplaceImages( ( value ? 'all' : 'none' ) );
												}}
											/>
											<ToggleControl
												className='kb-toggle-align-right small'
												label={__( 'Live Preview', 'kadence-blocks' )}
												checked={selectedPreviewMode !== 'image'}
												help={__('If disabled you will not see a live preview of how the patterns will look on your site.', 'kadence-blocks')}
												onChange={( value ) => {
													const tempActiveStorage = SafeParseJSON( localStorage.getItem( 'kadenceBlocksPrebuilt' ), true );
													tempActiveStorage['previewMode'] = value ? 'iframe' : 'image';
													localStorage.setItem( 'kadenceBlocksPrebuilt', JSON.stringify( tempActiveStorage ) );
													setPreviewMode( ( value ? 'iframe' : 'image' ) );
												}}
											/>
										</Popover>
									) }
									</Popover>
							) }
							{ wizardState.visible && (
								<AiWizard
									onClose={ closeAiWizard }
									onPrimaryAction={ handleAiWizardPrimaryAction }
									photographyOnly={ wizardState.photographyOnly }
									credits={ currentCredits }
								/>
							) }
						</div>
					</div>
					<div className="kb-library-sidebar-sub-choices">
						<Button
								className={ 'kb-subtab-button kb-trigger-design' + ( selectedContextTab === 'design' ? ' is-pressed' : '' ) }
								aria-pressed={ selectedContextTab === 'design' }
								onClick={ () => {
									const tempActiveStorage = SafeParseJSON( localStorage.getItem( 'kadenceBlocksPrebuilt' ), true );
									tempActiveStorage['contextTab'] = 'design';
									localStorage.setItem( 'kadenceBlocksPrebuilt', JSON.stringify( tempActiveStorage ) );
									forceRefreshLibrary();
									setContextTab( 'design' );
								}}
							>
								{ __( 'By Design', 'kadence-blocks' ) }
							</Button>
							<Button
								className={ 'kb-subtab-button kb-trigger-context' + ( selectedContextTab === 'context' ? ' is-pressed' : '' ) }
								aria-pressed={ selectedContextTab === 'context' }
								icon={ aiIcon }
								iconPosition='left'
								iconSize={ 16 }
								text={ __( 'With AI', 'kadence-blocks' )}
								onClick={ () => {
									const tempActiveStorage = SafeParseJSON( localStorage.getItem( 'kadenceBlocksPrebuilt' ), true );
									tempActiveStorage['contextTab'] = 'context';
									localStorage.setItem( 'kadenceBlocksPrebuilt', JSON.stringify( tempActiveStorage ) );
									forceRefreshLibrary();
									setContextTab( 'context' );
								}}
							/>
					</div>
					<div className="kb-library-sidebar-context-choices">
						<Button
							className={ 'kb-context-tab-button kb-trigger-patterns' + ( selectedSubTab === 'patterns' ? ' is-pressed' : '' ) }
							aria-pressed={ selectedSubTab === 'patterns' }
							onClick={ () => {
								const tempActiveStorage = SafeParseJSON( localStorage.getItem( 'kadenceBlocksPrebuilt' ), true );
								tempActiveStorage['subTab'] = 'patterns';
								localStorage.setItem( 'kadenceBlocksPrebuilt', JSON.stringify( tempActiveStorage ) );
								setSubTab( 'patterns' );
							}}
						>
							{ __( 'Patterns', 'kadence-blocks' ) }
						</Button>
						<Button
							className={ 'kb-context-tab-button kb-trigger-pages' + ( selectedSubTab === 'pages' ? ' is-pressed' : '' ) }
							aria-pressed={ selectedSubTab === 'pages' }
							onClick={ () => {
								const tempActiveStorage = SafeParseJSON( localStorage.getItem( 'kadenceBlocksPrebuilt' ), true );
								tempActiveStorage['subTab'] = 'pages';
								localStorage.setItem( 'kadenceBlocksPrebuilt', JSON.stringify( tempActiveStorage ) );
								setSubTab( 'pages' );
							}}
						>
							{ __( 'Pages', 'kadence-blocks' ) }
						</Button>
					</div>

				</div>
				<div className='kb-prebuilt-sidebar-body-wrap'>
					<div className="kb-library-sidebar-search">
						<SearchControl
							value={ search }
							placeholder={ __( 'Search', 'kadence-blocks' ) }
							onChange={ value => setSearch( value ) }
						/>
					</div>
					<div className="kb-library-sidebar-bottom-wrap">
						<div className={ `kb-library-sidebar-bottom ${ selectedContextTab === 'context' ? 'kb-context-library-categories' : 'kb-design-library-categories' }`}>
							{ selectedSubTab === 'pages' ? (
								<>
									{ selectedContextTab === 'design' ? (
										<>
											{ ! search && (
												<>
													{ pageCategoryListOptions.map( ( category, index ) =>
														<Button
															key={ `${ category.value }-${ index }` }
															className={ 'kb-category-button' + ( selectedPageCategory === category.value ? ' is-pressed' : '' ) }
															aria-pressed={ selectedPageCategory === category.value }
															onClick={ () => {
																const tempActiveStorage = SafeParseJSON( localStorage.getItem( 'kadenceBlocksPrebuilt' ), true );
																tempActiveStorage['kbPageCat'] = category.value;
																localStorage.setItem( 'kadenceBlocksPrebuilt', JSON.stringify( tempActiveStorage ) );
																setPageCategory( category.value );
															}}
														>
															{ category.label }
														</Button>
													) }
												</>
											) }
										</>
									) : (
										<>
											{ pageContextListOptions.map( ( category, index ) =>
												<Button
													key={ `${ category.value }-${ index }` }
													className={ 'kb-category-button' + ( selectedPageCategory === category.value ? ' is-pressed' : '' ) }
													aria-pressed={ selectedPageCategory === category.value }
													onClick={ () => {
														const tempActiveStorage = SafeParseJSON( localStorage.getItem( 'kadenceBlocksPrebuilt' ), true );
														tempActiveStorage['kbPageCat'] = category.value;
														localStorage.setItem( 'kadenceBlocksPrebuilt', JSON.stringify( tempActiveStorage ) );
														setPageCategory( category.value );
													}}
												>
													{ category.label }
												</Button>
											) }
										</>
									) }
								</>
							) : (
								<>
									{ selectedContextTab === 'design' ? (
										<>
											{ ! search && (
												<>
													{ categoryListOptions.map( ( category, index ) =>
														<Button
															key={ `${ category.value }-${ index }` }
															className={ 'kb-category-button' + ( selectedCategory === category.value ? ' is-pressed' : '' ) }
															aria-pressed={ selectedCategory === category.value }
															onClick={ () => {
																const tempActiveStorage = SafeParseJSON( localStorage.getItem( 'kadenceBlocksPrebuilt' ), true );
																tempActiveStorage['kbCat'] = category.value;
																localStorage.setItem( 'kadenceBlocksPrebuilt', JSON.stringify( tempActiveStorage ) );
																setCategory( category.value );
															}}
														>
															{ category.label }
														</Button>
													) }
												</>
											) }
										</>
									) : (
										<>
											{ contextListOptions.map( ( contextCategory, index ) =>
												<div key={ `${ contextCategory.value }-${ index }` } className={`context-category-wrap${ ( ( ( !isAIDisabled && localContexts && localContexts.includes( contextCategory.value ) ) || ( ! isAIDisabled && isContextRunning( contextCategory.value ) ) ) ? ' has-content' : '' )}`}>
													<Button
														className={ `kb-category-button${ ( selectedContext === contextCategory.value ? ' is-pressed' : '' )}` }
														aria-pressed={ selectedContext === contextCategory.value }
														onClick={ () => {
															const tempActiveStorage = SafeParseJSON( localStorage.getItem( 'kadenceBlocksPrebuilt' ), true );
															tempActiveStorage['context'] = contextCategory.value;
															localStorage.setItem( 'kadenceBlocksPrebuilt', JSON.stringify( tempActiveStorage ) );
															setContext( contextCategory.value );
														}}
													>
														{ isContextRunning( contextCategory.value ) ? <Spinner /> : ''}
														{ contextCategory.label }
													</Button>
													{ ! isAIDisabled && selectedContext === contextCategory.value && (
														<>
															<Button
																className={ 'kb-reload-context-popover-toggle' + ( isContextReloadVisible ? ' is-pressed' : '' ) }
																aria-pressed={ isContextReloadVisible }
																ref={ setPopoverContextAnchor }
																icon={ update }
																disabled={ isContextReloadVisible }
																onClick={ debounce( toggleReloadVisible, 100 ) }
															>
															</Button>
															{ isContextReloadVisible && (
																<Popover
																	className="kb-library-extra-settings"
																	placement="top-end"
																	onClose={ debounce( toggleReloadVisible, 100 ) }
																	anchor={ popoverContextAnchor }
																>
																	<p>{ sprintf(
																		/* translators: %s is the credit amount */
																		__( 'You can regenerate AI content for this context. This will use %s credits and your current ai text will be forever lost. Would you like to regenerate AI content for this context?', 'kadence-blocks' ),
																		CONTEXT_PROMPTS?.[contextCategory.value] ? CONTEXT_PROMPTS[contextCategory.value] : '1'
																	) }</p>
																	<div className='kt-remaining-credits'>{ currentCredits } { __( 'Credits Remaining', 'kadence-blocks' ) }</div>
																	<Button
																		variant='primary'
																		icon={ aiIcon }
																		iconSize={ 16 }
																		disabled={ isContextRunning( contextCategory.value ) }
																		iconPosition='right'
																		text={ sprintf(
																			/* translators: %s is the credit amount */
																			__( 'Regenerate Content (%s Credits)', 'kadence-blocks' ),
																			CONTEXT_PROMPTS?.[contextCategory.value] ? CONTEXT_PROMPTS[contextCategory.value] : '1'
																		) }
																		className={ 'kb-reload-context-confirm' }
																		onClick={ () => {
																			setIsContextReloadVisible(false);
																			reloadAI( selectedContext );
																		}}
																	/>
																</Popover>
															) }
														</>
													)}
												</div>
											) }
										</>
									) }
								</>
							) }
						</div>
					</div>
				</div>
				{ selectedSubTab !== 'pages' && (
					<div className="kb-library-sidebar-fixed-bottom kb-library-color-select-wrap">
						<h2>{ __( 'Style', 'kadence-blocks' ) }</h2>
						<div className="kb-library-style-options">
							{ styleOptions.map( ( style, index ) =>
								<Button
									key={ `${ style.value }-${ index }` }
									label={ style.label }
									className={ 'kb-style-button kb-style-' + style.value + ( selectedStyle === style.value ? ' is-pressed' : '' ) }
									aria-pressed={ selectedStyle === style.value }
									onClick={ () => {
										const tempActiveStorage = SafeParseJSON( localStorage.getItem( 'kadenceBlocksPrebuilt' ), true );
										tempActiveStorage['style'] = style.value;
										localStorage.setItem( 'kadenceBlocksPrebuilt', JSON.stringify( tempActiveStorage ) );
										setStyle( style.value );
									}}
								>
									<span></span>
								</Button>
							) }
						</div>
					</div>
				) }
				{ selectedSubTab === 'pages' && (
					<div className="kb-library-sidebar-fixed-bottom kb-library-color-select-wrap">
						<h2>{ __( 'Style', 'kadence-blocks' ) }</h2>
						<div className="kb-library-style-options">
							{ pageStyleOptions.map( ( style, index ) =>
								<Button
									key={ `${ style.value }-${ index }` }
									label={ style.label }
									className={ 'kb-style-button kb-style-' + style.value + ( selectedStyle === style.value ? ' is-pressed' : '' ) }
									aria-pressed={ selectedStyle === style.value || ( selectedStyle === 'highlight' && style.value === 'light' ) }
									onClick={ () => {
										const tempActiveStorage = SafeParseJSON( localStorage.getItem( 'kadenceBlocksPrebuilt' ), true );
										tempActiveStorage['style'] = style.value;
										localStorage.setItem( 'kadenceBlocksPrebuilt', JSON.stringify( tempActiveStorage ) );
										setStyle( style.value );
									}}
								>
									<span></span>
								</Button>
							) }
						</div>
						{ /* Temp removal as we are not using */ }
						{ false && styleTerms && styleTerms.length ? (
							<div className="kb-styles-filter-popover">
								<Button
									className={ 'kb-trigger-filter-settings' }
									icon={ settings }
									ref={ setFilterPopoverAnchor }
									isPressed={ isFilterVisible }
									disabled={ isFilterVisible }
									onClick={ toggleFilterVisible }
								/>
								{ isFilterVisible && (
									<Popover
										className="kb-library-filter-settings"
										placement="top-end"
										onClose={ debounce( toggleFilterVisible, 100 ) }
										anchor={ filterPopoverAnchor }
									>
										{
											styleTerms.map((term, index) => {
												return (
													<ToggleControl
														key={ index }
														className={ 'kb-toggle-align-right small' }
														label={ term }
														checked={ filterChoices[index] }
														onChange={ () => handleFilterToggle(index) }
													/>
												)
												}
											)
										}
									</Popover>
								) }
							</div>
						) : null }
					</div>
				) }
			</div>
			{ selectedSubTab === 'pages' ? (
				<>
					{ ( isImporting || isLoading || false === pages || isError ) ? (
						<>
							{ ! isError && isLoading && (
								<div className="kb-loading-library"><Spinner /></div>
							) }
							{ ! isError && isImporting &&  (
								<div className="preparing-importing-images">
									<Spinner />
									<h2>{ __( 'Preparing Content...', 'kadence-blocks' ) }</h2>
								</div>
							) }
							{ isError && isErrorType === 'general' && (
								<div className='kb-pattern-error-wrapper'>
									<h2 style={ { textAlign:'center' } }>
										{ __( 'Error, Unable to access library database, please try re-syncing', 'kadence-blocks' ) }
									</h2>
									<div style={ { textAlign:'center' } }>
										<Button
											className="kt-reload-templates"
											icon={ update }
											onClick={ () => ! isLoading ? getLibraryContent( selectedSubTab, true ) : null }
										>
											{ __( ' Sync with Cloud', 'kadence-blocks' ) }
										</Button>
									</div>
								</div>
							) }
							{ isError && isErrorType === 'reload' && (
								<div className='kb-pattern-error-wrapper'>
									<h2 style={ { textAlign:'center' } }>
										{ __( 'Error, Unable to access library, please reload this page in your browser.', 'kadence-blocks' ) }
									</h2>
								</div>
							) }
							{/* { false === pages && (
								<>{ loadPagesData() }</>
							) } */}
						</>
					) : (
						<PageList
							pages={ pages }
							filterValue={ search }
							selectedCategory={ selectedPageCategory }
							selectedStyle={ selectedStyle }
							selectedPageStyles={ selectedPageStyles }
							selectedFontSize={ selectedFontSize }
							breakpointCols={ breakpointColumnsObj }
							aiContent={ aiContent }
							aiContext={ selectedContext }
							contextTab={ selectedContextTab }
							imageCollection={ imageCollection }
							useImageReplace={ selectedReplaceImages }
							userData={ aIUserData }
							onSelect={ ( pattern ) => onInsertContent( pattern ) }
							launchWizard={ () => {
								sendEvent( 'ai_wizard_started' );
								setWizardState( {
									visible: true,
									photographyOnly: false
								} );
							} }
						/>
					) }
				</>
			) : (
				<>
					{ ( isImporting || isLoading || false === patterns || isError ) ? (
						<>
							{ ! isError && isLoading && (
								<div className="kb-loading-library"><Spinner /></div>
							) }
							{ ! isError && isImporting &&  (
								<div className="preparing-importing-images">
									<Spinner />
									<h2>{ __( 'Preparing Content...', 'kadence-blocks' ) }</h2>
								</div>
							) }
							{ isError && isErrorType === 'general' && (
								<div className='kb-pattern-error-wrapper'>
									<h2 style={ { textAlign:'center' } }>
										{ __( 'Error, Unable to access library database, please try re-syncing', 'kadence-blocks' ) }
									</h2>
									<div style={ { textAlign:'center' } }>
										<Button
											className="kt-reload-templates"
											icon={ update }
											onClick={ () => ! isLoading ? getLibraryContent( selectedSubTab, true ) : null }
										>
											{ __( ' Sync with Cloud', 'kadence-blocks' ) }
										</Button>
									</div>
								</div>
							) }
							{ isError && isErrorType === 'reload' && (
								<div className='kb-pattern-error-wrapper'>
									<h2 style={ { textAlign:'center' } }>
										{ __( 'Error, Unable to access library, please reload this page in your browser.', 'kadence-blocks' ) }
									</h2>
								</div>
							) }
						</>
					) : (
						<PatternList
							patterns={ patterns }
							filterValue={ search }
							selectedCategory={ selectedCategory }
							selectedStyle={ selectedStyle }
							selectedFontSize={ selectedFontSize }
							breakpointCols={ breakpointColumnsObj }
							contextTab={ selectedContextTab }
							aINeedsData={ aINeedsData }
							aiContext={ selectedContext }
							contextLabel={ selectedContextLabel }
							previewMode={ savedPreviewMode }
							imageCollection={ imageCollection }
							teamCollection={ teamCollection }
							onSelect={ ( pattern ) => onInsertContent( pattern ) }
							contextStatesRef={ contextStatesRef }
							useImageReplace={ selectedReplaceImages }
							userData={ aIUserData }
							generateContext={ ( tempCon ) => {
								setIsContextReloadVisible(false);
								reloadAI( tempCon );
							} }
							launchWizard={ () => {
								sendEvent( 'ai_wizard_started' );
								setWizardState( {
									visible: true,
									photographyOnly: false
								} );
							} }
							categories={ categoryListOptions }
							styles={ styleListOptions }
						/>
					) }
				</>
			) }
		</div>
	);
}
const PatternLibraryWrapper = withDispatch(
	( dispatch, { canUserUseUnfilteredHTML } ) => ( {
		importContent( blockcode, clientId ) {
			const { replaceBlocks } = dispatch( blockEditorStore );
			replaceBlocks(
				clientId,
				rawHandler( {
					HTML: blockcode,
					mode: 'BLOCKS',
					canUserUseUnfilteredHTML,
				} ),
			);
		}
	} )
)( PatternLibrary );
const PatternLibraryEdit = ( props ) => {
	const { canUserUseUnfilteredHTML } = useSelect(
		( select ) => {
			return {
				canUserUseUnfilteredHTML: select( 'core/editor' ) ? select( 'core/editor' ).canUserUseUnfilteredHTML() : false
			};
		},
		[]
	);
	return <PatternLibraryWrapper canUserUseUnfilteredHTML={ canUserUseUnfilteredHTML }  { ...props } />;
};
export default PatternLibraryEdit;
