<?php
/**
 * Plugin Name: Enable Yoast REST Meta
 * Description: Yoast SEO의 메타 디스크립션/포커스 키워드를 REST API로 쓸 수 있게 노출합니다.
 *              wp-content/mu-plugins/ 에 이 파일을 그대로 올리면 자동으로 적용됩니다.
 */

add_action('rest_api_init', function () {
    $fields = ['_yoast_wpseo_metadesc', '_yoast_wpseo_focuskw'];

    foreach ($fields as $field) {
        register_post_meta('post', $field, [
            'show_in_rest' => true,
            'single' => true,
            'type' => 'string',
            'auth_callback' => function () {
                return current_user_can('edit_posts');
            },
        ]);
    }
});
